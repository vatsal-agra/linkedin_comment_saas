"""Tracked LinkedIn profiles CRUD."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/profiles", tags=["profiles"])

_LINKEDIN_RE = re.compile(r"linkedin\.com/in/", re.IGNORECASE)


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Empty URL")
    if not url.lower().startswith("http"):
        url = "https://" + url
    if not _LINKEDIN_RE.search(url):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"Not a LinkedIn profile URL (expected linkedin.com/in/...): {url}",
        )
    return url.rstrip("/") + "/"


@router.get("", response_model=list[schemas.ProfileResponse])
def list_profiles(
    user: models.User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return (
        db.execute(
            select(models.TrackedProfile)
            .where(models.TrackedProfile.user_id == user.id)
            .order_by(models.TrackedProfile.created_at)
        )
        .scalars()
        .all()
    )


@router.post("", response_model=schemas.ProfileResponse, status_code=status.HTTP_201_CREATED)
def add_profile(
    body: schemas.ProfileCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    url = _normalize_url(body.url)
    existing = db.execute(
        select(models.TrackedProfile).where(
            models.TrackedProfile.user_id == user.id,
            models.TrackedProfile.url == url,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing
    p = models.TrackedProfile(user_id=user.id, url=url)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.post("/bulk", response_model=list[schemas.ProfileResponse])
def add_bulk(
    body: schemas.ProfileBulkCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    out: list[models.TrackedProfile] = []
    for raw in body.urls:
        try:
            url = _normalize_url(raw)
        except HTTPException:
            continue  # silently skip malformed lines in a bulk paste
        existing = db.execute(
            select(models.TrackedProfile).where(
                models.TrackedProfile.user_id == user.id,
                models.TrackedProfile.url == url,
            )
        ).scalar_one_or_none()
        if existing is not None:
            out.append(existing)
            continue
        p = models.TrackedProfile(user_id=user.id, url=url)
        db.add(p)
        db.flush()
        out.append(p)
    db.commit()
    return out


@router.delete("/{profile_id}", response_model=schemas.MessageResponse)
def delete_profile(
    profile_id: int,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    p = db.get(models.TrackedProfile, profile_id)
    if p is None or p.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found")
    db.delete(p)
    db.commit()
    return schemas.MessageResponse(message="deleted")
