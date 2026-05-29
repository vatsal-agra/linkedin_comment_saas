"""Runtime configuration, loaded from environment / .env.

Single source of truth for the backend. Secrets live ONLY in the environment
(never in the repo): MASTER_ENCRYPTION_KEY and JWT_SECRET are required.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# backend/  (parent of app/)
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# --- Database ---------------------------------------------------------------
DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DATA_DIR / 'app.db'}")

# --- Secrets (required) -----------------------------------------------------
MASTER_ENCRYPTION_KEY: str = os.getenv("MASTER_ENCRYPTION_KEY", "").strip()
JWT_SECRET: str = os.getenv("JWT_SECRET", "").strip()
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", str(60 * 24 * 14)))  # 14 days

# --- CORS -------------------------------------------------------------------
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

# --- Pipeline defaults ------------------------------------------------------
APIFY_ACTOR: str = os.getenv("APIFY_ACTOR", "harvestapi/linkedin-profile-posts")
DEFAULT_GEMINI_MODEL: str = os.getenv("DEFAULT_GEMINI_MODEL", "gemini-2.5-flash")


def validate_startup() -> None:
    """Fail fast if required secrets are missing."""
    missing = []
    if not MASTER_ENCRYPTION_KEY:
        missing.append("MASTER_ENCRYPTION_KEY")
    if not JWT_SECRET:
        missing.append("JWT_SECRET")
    if missing:
        raise RuntimeError(
            "Missing required environment variables: "
            + ", ".join(missing)
            + ". Copy backend/.env.example to backend/.env and fill them in."
        )
