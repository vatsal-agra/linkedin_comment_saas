"""Per-user dedup backed by the shared SQLite DB (seen_posts table)."""
from __future__ import annotations

from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import SeenPost


def filter_unseen(db: Session, user_id: int, posts: List[Dict]) -> List[Dict]:
    urls = [p["url"] for p in posts if p.get("url")]
    if not urls:
        return []
    rows = db.execute(
        select(SeenPost.post_url).where(
            SeenPost.user_id == user_id, SeenPost.post_url.in_(urls)
        )
    ).all()
    seen = {r[0] for r in rows}
    return [p for p in posts if p.get("url") and p["url"] not in seen]


def mark_seen(db: Session, user_id: int, post_url: str, author: str = "") -> None:
    # Avoid duplicate-insert errors on the (user_id, post_url) unique constraint.
    exists = db.execute(
        select(SeenPost.id).where(
            SeenPost.user_id == user_id, SeenPost.post_url == post_url
        )
    ).first()
    if exists:
        return
    db.add(SeenPost(user_id=user_id, post_url=post_url, author=author))
