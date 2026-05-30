"""Run the full pipeline for ONE user: fetch -> dedup -> score -> draft -> send.

This is the per-user equivalent of the original src/main.py. It creates its own
DB session (it runs inside scheduler threads), decrypts that user's keys in
memory only, and never logs secret values.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Dict

from google import genai

from app import config, crypto, models
from app.database import SessionLocal
from app.pipeline import dedup, drafter, fetcher, relevance, telegram_sender


class PipelineError(Exception):
    pass


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def run_for_user(user_id: int, trigger: str = "schedule") -> Dict:
    """Execute one full cycle for a user. Returns a summary dict.

    Records a RunHistory row regardless of outcome. Raises nothing for normal
    pipeline failures — they are captured in the run record and returned.
    """
    db = SessionLocal()
    run = models.RunHistory(user_id=user_id, trigger=trigger, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    try:
        user = db.get(models.User, user_id)
        if user is None:
            raise PipelineError("user not found")
        settings = user.settings
        if settings is None:
            raise PipelineError("user has no settings")

        if trigger == "schedule" and not settings.enabled:
            return _finish(db, run, "success", "schedule disabled; skipped", 0, 0)

        apify_token = crypto.decrypt(settings.apify_key_enc)
        gemini_key = crypto.decrypt(settings.gemini_key_enc)
        bot_token = crypto.decrypt(settings.telegram_bot_token_enc)
        chat_id = crypto.decrypt(settings.telegram_chat_id_enc)

        missing = [
            name
            for name, val in [
                ("Apify key", apify_token),
                ("Gemini key", gemini_key),
                ("Telegram bot token", bot_token),
                ("Telegram chat id", chat_id),
            ]
            if not val
        ]
        if missing:
            raise PipelineError("missing credentials: " + ", ".join(missing))

        profile_urls = [p.url for p in user.profiles]
        if not profile_urls:
            raise PipelineError("no tracked profiles configured")

        profile_text = settings.profile_text or ""
        style_samples = settings.style_samples or ""
        model_name = settings.gemini_model or config.DEFAULT_GEMINI_MODEL
        threshold = int(settings.relevance_threshold)
        posts_per_profile = int(settings.posts_per_profile)
        max_per_account = int(settings.max_drafts_per_account)

        # 1. Fetch (uses the user's Apify token)
        posts = fetcher.fetch_posts(
            apify_token=apify_token,
            actor_id=config.APIFY_ACTOR,
            profile_urls=profile_urls,
            posts_per_profile=posts_per_profile,
        )
        run.posts_fetched = len(posts)
        db.commit()

        if not posts:
            return _finish(db, run, "success", "no posts returned by Apify", 0, 0)

        # 2. Dedup (per user)
        new_posts = dedup.filter_unseen(db, user_id, posts)
        if not new_posts:
            return _finish(db, run, "success", "nothing new since last run", len(posts), 0)

        # 3. Score + draft, with per-account cap
        gemini_client = genai.Client(api_key=gemini_key)
        drafts = []
        per_source: dict = defaultdict(int)
        for post in new_posts:
            source = post.get("source_profile") or post.get("author") or "unknown"
            if per_source[source] >= max_per_account:
                continue

            score_info = relevance.score_post(gemini_client, post, profile_text, model_name)
            if score_info["score"] < threshold:
                continue

            comment = drafter.draft_comment(
                gemini_client, post, profile_text, style_samples, model_name
            )
            if not comment or comment.strip().upper() == "SKIP":
                continue

            drafts.append(
                {
                    "author": post.get("author", ""),
                    "url": post.get("url", ""),
                    "text": post.get("text", ""),
                    "comment": comment,
                    "score": score_info["score"],
                    "reason": score_info["reason"],
                }
            )
            per_source[source] += 1

        # 4. Deliver via the user's Telegram bot (silent if empty)
        telegram_sender.send_report(bot_token, chat_id, drafts)

        # 5. Mark seen ONLY after a successful send
        dedup.mark_seen(db, user_id, new_posts)

        settings.last_run_at = _utcnow()
        db.commit()

        return _finish(
            db, run, "success",
            f"{len(drafts)} draft(s) sent",
            len(posts), len(drafts),
        )

    except Exception as e:  # noqa: BLE001
        db.rollback()
        # Re-load run (rollback may have expired it) and mark error.
        run = db.get(models.RunHistory, run.id)
        return _finish(db, run, "error", str(e)[:500], run.posts_fetched if run else 0, 0)
    finally:
        db.close()


def _finish(db, run, status: str, message: str, fetched: int, drafts: int) -> Dict:
    run.status = status
    run.message = message
    run.posts_fetched = fetched
    run.drafts_count = drafts
    run.finished_at = _utcnow()
    db.commit()
    print(f"[runner] user={run.user_id} status={status} drafts={drafts} :: {message}")
    return {
        "status": status,
        "message": message,
        "posts_fetched": fetched,
        "drafts_count": drafts,
    }
