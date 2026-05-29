"""Signup / login / current-user endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models, schemas, security
from app.database import get_db
from app.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", response_model=schemas.TokenResponse)
def signup(body: schemas.SignupRequest, db: Session = Depends(get_db)):
    email = body.email.lower()
    existing = db.execute(
        select(models.User).where(models.User.email == email)
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "An account with this email already exists"
        )

    user = models.User(
        email=email,
        password_hash=security.hash_password(body.password),
        onboarded=False,
    )
    db.add(user)
    db.flush()  # assign user.id
    db.add(models.UserSettings(user_id=user.id))
    db.commit()
    db.refresh(user)

    token = security.create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, onboarded=user.onboarded)


@router.post("/login", response_model=schemas.TokenResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.execute(
        select(models.User).where(models.User.email == body.email.lower())
    ).scalar_one_or_none()
    if user is None or not security.verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")

    token = security.create_access_token(user.id)
    return schemas.TokenResponse(access_token=token, onboarded=user.onboarded)


@router.get("/me", response_model=schemas.UserResponse)
def me(user: models.User = Depends(get_current_user)):
    return user
