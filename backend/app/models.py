"""Database models. One row per user; all secrets stored encrypted."""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    onboarded = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    settings = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    profiles = relationship(
        "TrackedProfile",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )

    # --- Encrypted secrets (Fernet tokens stored as text) ---
    apify_key_enc = Column(Text, default="")
    gemini_key_enc = Column(Text, default="")
    telegram_bot_token_enc = Column(Text, default="")
    telegram_chat_id_enc = Column(Text, default="")

    # --- Tuning ---
    gemini_model = Column(String(64), default="gemini-2.5-flash")
    relevance_threshold = Column(Integer, default=7)
    posts_per_profile = Column(Integer, default=5)
    max_drafts_per_account = Column(Integer, default=2)

    # --- Schedule ---
    schedule_hour = Column(Integer, default=0)      # 0-23, in the user's timezone
    schedule_minute = Column(Integer, default=0)    # 0-59
    timezone = Column(String(64), default="Asia/Kolkata")
    enabled = Column(Boolean, default=False, nullable=False)

    # --- Voice / profile ---
    profile_text = Column(Text, default="")
    style_samples = Column(Text, default="")

    # --- Bookkeeping ---
    last_run_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="settings")


class TrackedProfile(Base):
    __tablename__ = "tracked_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    url = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="profiles")

    __table_args__ = (UniqueConstraint("user_id", "url", name="uq_user_profile"),)


class SeenPost(Base):
    """Per-user dedup of posts already drafted/sent."""

    __tablename__ = "seen_posts"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    post_url = Column(String(700), nullable=False)
    author = Column(String(300), default="")
    seen_at = Column(DateTime, default=utcnow)

    __table_args__ = (UniqueConstraint("user_id", "post_url", name="uq_user_post"),)


class RunHistory(Base):
    __tablename__ = "run_history"

    id = Column(Integer, primary_key=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    started_at = Column(DateTime, default=utcnow)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String(32), default="running")   # running | success | error
    trigger = Column(String(16), default="schedule")  # schedule | manual
    posts_fetched = Column(Integer, default=0)
    drafts_count = Column(Integer, default=0)
    message = Column(Text, default="")
