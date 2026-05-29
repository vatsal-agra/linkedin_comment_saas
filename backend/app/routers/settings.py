"""Settings: encrypted keys, tuning, schedule, and voice/profile text."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crypto, models, scheduler, schemas
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])


def _keys_status(s: models.UserSettings) -> schemas.KeysStatus:
    return schemas.KeysStatus(
        apify_set=bool(s.apify_key_enc),
        gemini_set=bool(s.gemini_key_enc),
        telegram_bot_set=bool(s.telegram_bot_token_enc),
        telegram_chat_set=bool(s.telegram_chat_id_enc),
    )


def _settings_response(s: models.UserSettings) -> schemas.SettingsResponse:
    return schemas.SettingsResponse(
        gemini_model=s.gemini_model,
        relevance_threshold=s.relevance_threshold,
        posts_per_profile=s.posts_per_profile,
        max_drafts_per_account=s.max_drafts_per_account,
        schedule_hour=s.schedule_hour,
        schedule_minute=s.schedule_minute,
        timezone=s.timezone,
        enabled=s.enabled,
        profile_text=s.profile_text or "",
        style_samples=s.style_samples or "",
        last_run_at=s.last_run_at,
        keys=_keys_status(s),
    )


@router.get("", response_model=schemas.SettingsResponse)
def get_settings(
    user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _settings_response(user.settings)


@router.put("", response_model=schemas.SettingsResponse)
def update_settings(
    body: schemas.SettingsUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = user.settings
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    # Schedule/enabled/timezone changes must be reflected in the scheduler.
    scheduler.sync_user(user.id)
    return _settings_response(s)


@router.put("/keys", response_model=schemas.SettingsResponse)
def update_keys(
    body: schemas.KeysUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = user.settings
    data = body.model_dump(exclude_unset=True)
    mapping = {
        "apify_key": "apify_key_enc",
        "gemini_key": "gemini_key_enc",
        "telegram_bot_token": "telegram_bot_token_enc",
        "telegram_chat_id": "telegram_chat_id_enc",
    }
    for field, col in mapping.items():
        if field in data:
            val = (data[field] or "").strip()
            setattr(s, col, crypto.encrypt(val) if val else "")

    # Mark onboarding complete once all four credentials are present.
    all_set = all(
        [s.apify_key_enc, s.gemini_key_enc, s.telegram_bot_token_enc, s.telegram_chat_id_enc]
    )
    if all_set and not user.onboarded:
        user.onboarded = True

    db.commit()
    db.refresh(s)
    return _settings_response(s)
