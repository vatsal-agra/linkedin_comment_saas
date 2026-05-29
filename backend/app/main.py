"""FastAPI application entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import config, models, scheduler  # noqa: F401 (models registers tables)
from app.database import Base, engine
from app.routers import auth, profiles, runs, settings, telegram


@asynccontextmanager
async def lifespan(_app: FastAPI):
    config.validate_startup()
    Base.metadata.create_all(bind=engine)
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown()


app = FastAPI(title="LinkedIn Replier API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(settings.router)
app.include_router(profiles.router)
app.include_router(runs.router)
app.include_router(telegram.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}
