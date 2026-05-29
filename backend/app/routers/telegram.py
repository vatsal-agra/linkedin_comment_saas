"""Telegram onboarding helper: discover the user's chat_id from their bot."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app import models, schemas
from app.deps import get_current_user
from app.pipeline.telegram_sender import discover_chat_ids

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/discover-chat-id", response_model=schemas.TelegramDiscoverResponse)
def discover(
    body: schemas.TelegramDiscoverRequest,
    user: models.User = Depends(get_current_user),
):
    try:
        chats = discover_chat_ids(body.bot_token.strip())
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Could not reach Telegram: {e}")
    return schemas.TelegramDiscoverResponse(
        chats=[schemas.TelegramChatOption(**c) for c in chats]
    )
