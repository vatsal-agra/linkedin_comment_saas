"""Pydantic request/response models. Secrets are NEVER returned to clients —
only booleans indicating whether a key is set."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


# --- Auth -------------------------------------------------------------------
class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    onboarded: bool


class UserResponse(BaseModel):
    id: int
    email: EmailStr
    onboarded: bool

    class Config:
        from_attributes = True


# --- Keys -------------------------------------------------------------------
class KeysUpdate(BaseModel):
    """All optional; only provided fields are updated. Empty string clears."""
    apify_key: str | None = None
    gemini_key: str | None = None
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None


class KeysStatus(BaseModel):
    apify_set: bool
    gemini_set: bool
    telegram_bot_set: bool
    telegram_chat_set: bool


# --- Settings ---------------------------------------------------------------
class SettingsResponse(BaseModel):
    gemini_model: str
    relevance_threshold: int
    posts_per_profile: int
    max_drafts_per_account: int
    schedule_hour: int
    schedule_minute: int
    timezone: str
    enabled: bool
    profile_text: str
    style_samples: str
    last_run_at: datetime | None
    keys: KeysStatus


class SettingsUpdate(BaseModel):
    gemini_model: str | None = None
    relevance_threshold: int | None = Field(default=None, ge=0, le=10)
    posts_per_profile: int | None = Field(default=None, ge=1, le=50)
    max_drafts_per_account: int | None = Field(default=None, ge=1, le=20)
    schedule_hour: int | None = Field(default=None, ge=0, le=23)
    schedule_minute: int | None = Field(default=None, ge=0, le=59)
    timezone: str | None = None
    enabled: bool | None = None
    profile_text: str | None = None
    style_samples: str | None = None

    @field_validator("timezone")
    @classmethod
    def _valid_tz(cls, v: str | None) -> str | None:
        if v is None:
            return v
        from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, Exception):  # noqa: BLE001
            raise ValueError(f"Unknown timezone: {v}")
        return v


# --- Profiles ---------------------------------------------------------------
class ProfileCreate(BaseModel):
    url: str = Field(min_length=5, max_length=500)


class ProfileBulkCreate(BaseModel):
    urls: list[str]


class ProfileResponse(BaseModel):
    id: int
    url: str
    created_at: datetime

    class Config:
        from_attributes = True


class ProfileSuggestResponse(BaseModel):
    urls: list[str]


# --- Runs -------------------------------------------------------------------
class RunResponse(BaseModel):
    id: int
    started_at: datetime
    finished_at: datetime | None
    status: str
    trigger: str
    posts_fetched: int
    drafts_count: int
    message: str

    class Config:
        from_attributes = True


# --- Telegram helper --------------------------------------------------------
class TelegramDiscoverRequest(BaseModel):
    bot_token: str = Field(min_length=10)


class TelegramChatOption(BaseModel):
    chat_id: str
    type: str
    name: str


class TelegramDiscoverResponse(BaseModel):
    chats: list[TelegramChatOption]


# --- Generic ----------------------------------------------------------------
class MessageResponse(BaseModel):
    message: str
