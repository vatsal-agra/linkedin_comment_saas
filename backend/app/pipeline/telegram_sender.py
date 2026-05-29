"""Send the draft-comment report to a user's Telegram chat.

Output format is IDENTICAL to the original single-user tool: one header
message plus one message per draft, each with the post link, why it scored,
a snippet, and the draft comment in a copy-friendly code block.
"""
from __future__ import annotations

import time
from typing import Dict, List

import requests

TELEGRAM_API = "https://api.telegram.org"
MAX_MESSAGE_LEN = 4000  # Telegram caps at 4096; leave headroom for HTML.


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _send_one(bot_token: str, chat_id: str, text: str) -> None:
    url = f"{TELEGRAM_API}/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
        "disable_web_page_preview": False,
    }
    r = requests.post(url, json=payload, timeout=30)
    if not r.ok:
        raise RuntimeError(f"Telegram send failed: {r.status_code} {r.text}")


def send_report(bot_token: str, chat_id: str, drafts: List[Dict]) -> None:
    """drafts: list of {author, url, text, comment, score, reason}."""
    if not drafts:
        print("[telegram] no drafts to send; staying silent.")
        return

    _send_one(bot_token, chat_id, f"<b>LinkedIn Replier</b> — {len(drafts)} new draft(s)")
    time.sleep(0.4)

    for i, d in enumerate(drafts, 1):
        author = _escape(d.get("author") or "Unknown")
        url = d.get("url") or ""
        score = d.get("score", "?")
        reason = _escape(d.get("reason") or "")
        comment = _escape(d.get("comment") or "")
        raw_snippet = (d.get("text") or "").replace("\n", " ")
        snippet_truncated = raw_snippet[:300]
        ellipsis = "…" if len(raw_snippet) > 300 else ""
        snippet = _escape(snippet_truncated)

        body = (
            f"<b>{i}. {author}</b>  (score {score}/10)\n"
            f"<a href=\"{_escape(url)}\">Open post on LinkedIn</a>\n"
            f"<i>Why:</i> {reason}\n\n"
            f"<i>Post:</i> {snippet}{ellipsis}\n\n"
            f"<b>Draft comment:</b>\n<code>{comment}</code>"
        )
        if len(body) > MAX_MESSAGE_LEN:
            body = body[:MAX_MESSAGE_LEN] + "…"

        _send_one(bot_token, chat_id, body)
        time.sleep(0.4)


def discover_chat_ids(bot_token: str) -> List[Dict]:
    """Replicates the old get_chat_id helper for onboarding: returns the chats
    that have messaged this bot, so the user can pick their chat_id."""
    url = f"{TELEGRAM_API}/bot{bot_token}/getUpdates"
    r = requests.get(url, timeout=15)
    if not r.ok:
        raise RuntimeError(f"Telegram getUpdates failed: {r.status_code} {r.text}")

    updates = r.json().get("result", [])
    out: List[Dict] = []
    seen = set()
    for u in updates:
        msg = u.get("message") or u.get("edited_message") or u.get("channel_post") or {}
        chat = msg.get("chat") or {}
        cid = chat.get("id")
        if cid is not None and cid not in seen:
            seen.add(cid)
            out.append(
                {
                    "chat_id": str(cid),
                    "type": chat.get("type", "?"),
                    "name": chat.get("first_name") or chat.get("title") or "",
                }
            )
    return out
