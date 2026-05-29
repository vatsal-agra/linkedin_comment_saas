"""Top-level job entrypoints referenced by the scheduler.

Kept in their own module (no FastAPI imports) so the scheduler can call them
cleanly from worker threads.
"""
from __future__ import annotations

from app.pipeline.runner import run_for_user


def run_user_job(user_id: int) -> None:
    try:
        run_for_user(user_id, trigger="schedule")
    except Exception as e:  # noqa: BLE001 — never let a job crash the scheduler
        print(f"[jobs] run_user_job failed for user {user_id}: {e}")
