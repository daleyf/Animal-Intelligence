"""
Background scheduler.

Uses APScheduler to run the morning report at a user-configured time each day.
The generated report is stored in AppSettings so the frontend can display it
without needing to re-generate on every page visit.

Usage (from main.py lifespan)::

    from core.scheduler import report_scheduler
    report_scheduler.start()
    ...
    report_scheduler.shutdown()
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)

_JOB_ID = "morning_report"


class ReportScheduler:
    """Thin wrapper around AsyncIOScheduler for morning report scheduling."""

    def __init__(self) -> None:
        self._scheduler = AsyncIOScheduler(timezone="UTC")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self, enabled: bool = False, time_str: str = "07:00") -> None:
        """Start the scheduler and add the report job if enabled.

        Idempotent — safe to call even if the scheduler is already running.
        Recreates the internal ``AsyncIOScheduler`` when stopped so it picks
        up the current asyncio event loop (needed in pytest where each
        ``TestClient`` context creates and tears down its own event loop).
        """
        if self._scheduler.running:
            logger.debug("ReportScheduler already running, skipping start")
        else:
            # Recreate to bind to the current event loop (test-safe)
            self._scheduler = AsyncIOScheduler(timezone="UTC")
            self._scheduler.start()

        if enabled:
            self._add_job(time_str)
        logger.info("ReportScheduler started (job enabled=%s, time=%s)", enabled, time_str)

    def shutdown(self) -> None:
        try:
            if self._scheduler.running:
                self._scheduler.shutdown(wait=False)
        except Exception as exc:  # noqa: BLE001
            logger.debug("ReportScheduler shutdown warning: %s", exc)

    # ------------------------------------------------------------------
    # Job management
    # ------------------------------------------------------------------

    def reschedule(self, enabled: bool, time_str: str) -> None:
        """Enable/disable or change the cron trigger without restarting."""
        self._scheduler.remove_job(_JOB_ID, jobstore=None)
        if enabled:
            self._add_job(time_str)
            logger.info("Morning report scheduled for %s UTC", time_str)
        else:
            logger.info("Morning report scheduling disabled")

    def _add_job(self, time_str: str) -> None:
        try:
            hour, minute = (int(p) for p in time_str.split(":")[:2])
        except (ValueError, AttributeError):
            hour, minute = 7, 0

        self._scheduler.add_job(
            _run_morning_report,
            trigger=CronTrigger(hour=hour, minute=minute, timezone="UTC"),
            id=_JOB_ID,
            replace_existing=True,
            misfire_grace_time=600,   # fire up to 10 min late if server was down
        )


async def _run_morning_report() -> None:
    """
    Triggered by the scheduler.  Generates the morning report and stores the
    full content in AppSettings so the frontend can load it on demand.
    """
    from db.database import SessionLocal
    from db.models import AppSettings
    from core.integrations.report_service import morning_report_service
    from db.crud.settings import get_all as get_all_settings

    logger.info("Scheduled morning report starting…")
    db = SessionLocal()
    try:
        all_settings = get_all_settings(db)
        model = all_settings.get("active_model", "llama3.1:8b")

        full_content = ""
        async for event in morning_report_service.generate(model=model):
            if event.get("type") == "token":
                full_content += event.get("content", "")

        now = datetime.now(timezone.utc).isoformat()
        for key, value in [
            ("last_report_content", full_content),
            ("last_report_generated_at", now),
        ]:
            row = db.get(AppSettings, key)
            if row:
                row.value = value
            else:
                db.add(AppSettings(key=key, value=value))
        db.commit()
        logger.info("Scheduled morning report stored (%d chars)", len(full_content))
    except Exception as exc:
        logger.error("Scheduled morning report failed: %s", exc)
    finally:
        db.close()


# Module-level singleton used by main.py
report_scheduler = ReportScheduler()
