"""Per-user daily scheduling via APScheduler.

Each enabled user gets exactly one cron job that fires at their chosen
hour:minute in their own timezone. Jobs live in memory and are rebuilt from
the database on startup (resync_all), so we avoid job-serialization pitfalls
while still surviving restarts.

Reliability note: misfire_grace_time lets a job still run if the VM was briefly
down at the scheduled minute — the gap that made GitHub Actions cron unreliable.
"""
from __future__ import annotations

from zoneinfo import ZoneInfo

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app import models
from app.database import SessionLocal
from app.jobs import run_user_job

_scheduler: BackgroundScheduler | None = None


def get_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = BackgroundScheduler(timezone="UTC")
    return _scheduler


def start() -> None:
    sch = get_scheduler()
    if not sch.running:
        sch.start()
    resync_all()


def shutdown() -> None:
    sch = get_scheduler()
    if sch.running:
        sch.shutdown(wait=False)


def _job_id(user_id: int) -> str:
    return f"user-{user_id}"


def schedule_user(user_id: int, hour: int, minute: int, tz: str) -> None:
    sch = get_scheduler()
    trigger = CronTrigger(hour=hour, minute=minute, timezone=ZoneInfo(tz))
    sch.add_job(
        run_user_job,
        trigger=trigger,
        id=_job_id(user_id),
        args=[user_id],
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,  # still run if we were down up to 1h
    )
    print(f"[scheduler] user {user_id} scheduled at {hour:02d}:{minute:02d} {tz}")


def unschedule_user(user_id: int) -> None:
    sch = get_scheduler()
    job = sch.get_job(_job_id(user_id))
    if job is not None:
        job.remove()
        print(f"[scheduler] user {user_id} unscheduled")


def sync_user(user_id: int) -> None:
    """Add/update or remove a user's job to match their current settings."""
    db = SessionLocal()
    try:
        s = db.get(models.UserSettings, user_id)
        if s is not None and s.enabled:
            schedule_user(user_id, s.schedule_hour, s.schedule_minute, s.timezone)
        else:
            unschedule_user(user_id)
    finally:
        db.close()


def resync_all() -> None:
    """Rebuild all jobs from the DB (called on startup)."""
    db = SessionLocal()
    try:
        rows = (
            db.query(models.UserSettings)
            .filter(models.UserSettings.enabled.is_(True))
            .all()
        )
        count = 0
        for s in rows:
            try:
                schedule_user(s.user_id, s.schedule_hour, s.schedule_minute, s.timezone)
                count += 1
            except Exception as e:  # noqa: BLE001
                print(f"[scheduler] failed to schedule user {s.user_id}: {e}")
        print(f"[scheduler] resynced {count} enabled user(s)")
    finally:
        db.close()


def next_run_time(user_id: int):
    job = get_scheduler().get_job(_job_id(user_id))
    return job.next_run_time if job else None
