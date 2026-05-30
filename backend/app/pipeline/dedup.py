"""Per-user dedup ledger backed by the seen_posts table.

Mirrors the single-user tool's SQLite dedup, but every query is scoped to a
user_id so one user can never see or affect another's state.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.orm import Session

from ..models import SeenPost, utcnow


def filter_unseen(db: Session, user_id: int, posts: list[dict]) -> list[dict]:
    """Return only posts whose URL we haven't recorded for this user yet.

    Also de-duplicates *within* this batch. The same post can be fetched more
    than once in a single run — e.g. a post reposted by several tracked
    profiles shares one canonical URL — and we want to score, draft, and
    record it exactly once.
    """
    if not posts:
        return []
    urls = [p.get("url", "") for p in posts if p.get("url")]
    if not urls:
        return []
    seen = set(
        db.scalars(
            select(SeenPost.post_url).where(
                SeenPost.user_id == user_id,
                SeenPost.post_url.in_(urls),
            )
        ).all()
    )
    out: list[dict] = []
    batch: set[str] = set()
    for p in posts:
        url = p.get("url", "")
        if not url or url in seen or url in batch:
            continue
        batch.add(url)
        out.append(p)
    return out


def mark_seen(db: Session, user_id: int, posts: list[dict]) -> None:
    """Record posts as seen for this user. Commits on success.

    Idempotent: any (user_id, post_url) pair that already exists — or is
    repeated within this batch (e.g. a repost) — is ignored via
    ON CONFLICT DO NOTHING instead of raising an IntegrityError, so re-runs
    and reposts can never crash the pipeline.
    """
    rows: dict[str, dict] = {}
    for p in posts:
        url = p.get("url", "")
        if not url or url in rows:
            continue
        rows[url] = {
            "user_id": user_id,
            "post_url": url,
            "author": p.get("author", ""),
            "seen_at": utcnow(),
        }
    if not rows:
        return
    stmt = sqlite_insert(SeenPost).values(list(rows.values())).on_conflict_do_nothing()
    db.execute(stmt)
    db.commit()
