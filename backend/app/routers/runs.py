"""Run history + manual test trigger."""
from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user
from app.pipeline.runner import run_for_user
from app.scheduler import next_run_time

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[schemas.RunResponse])
def list_runs(
    user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.execute(
            select(models.RunHistory)
            .where(models.RunHistory.user_id == user.id)
            .order_by(models.RunHistory.started_at.desc())
            .limit(20)
        )
        .scalars()
        .all()
    )


@router.get("/next")
def next_run(user: models.User = Depends(get_current_user)):
    nrt = next_run_time(user.id)
    return {"next_run_at": nrt.isoformat() if nrt else None}


@router.post("/test", response_model=schemas.MessageResponse)
def trigger_test(
    background: BackgroundTasks,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = user.settings
    if not all(
        [s.apify_key_enc, s.gemini_key_enc, s.telegram_bot_token_enc, s.telegram_chat_id_enc]
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Add all your API keys first (Apify, Gemini, Telegram bot + chat id).",
        )
    if not user.profiles:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Add at least one LinkedIn profile to track first.",
        )
    background.add_task(run_for_user, user.id, "manual")
    return schemas.MessageResponse(
        message="Test run started. Check your Telegram in a minute or two."
    )


@router.delete("/seen-posts", response_model=schemas.MessageResponse)
def reset_seen_posts(
    user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Clear the dedup history for this user so the next run re-evaluates all posts."""
    result = db.execute(
        delete(models.SeenPost).where(models.SeenPost.user_id == user.id)
    )
    db.commit()
    count = result.rowcount
    return schemas.MessageResponse(
        message=f"Cleared {count} seen post{'s' if count != 1 else ''}. The next run will re-fetch and re-score everything."
    )
