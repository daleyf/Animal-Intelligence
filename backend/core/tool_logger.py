"""
Tool invocation logger.

Every external tool call (web search, memory, weather, news, commute, calendar)
should be logged through this module.  Logs are append-only and PII is stripped
from input summaries before storage.
"""

from __future__ import annotations

import json as _json
import logging
import time
from contextlib import asynccontextmanager, contextmanager
from typing import AsyncIterator, Iterator

from sqlalchemy.orm import Session

from db.models import ToolLog

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Low-level write helper
# ---------------------------------------------------------------------------

def log_tool_call(
    db: Session,
    tool_name: str,
    input_summary: str = "",
    success: bool = True,
    error_message: str | None = None,
    duration_ms: int | None = None,
    session_id: str | None = None,
    sub_queries: list[str] | None = None,
    data_destination: str | None = None,
) -> None:
    """
    Write a single ToolLog row.  Never raises — log failures are swallowed so
    they never interrupt the main request path.

    Args:
        session_id: Groups related calls (e.g. all queries for one research session
                    or all tool calls for one morning report).
        sub_queries: Individual search strings executed within this call (e.g. the
                     2-3 queries the research agent auto-generated from one question).
        data_destination: Human-readable label of where data was sent, e.g.
                          "ollama.com/api/web_search" or "api.openweathermap.org".
                          None / omitted means the call was local-only.
    """
    try:
        db.add(
            ToolLog(
                tool_name=tool_name,
                input_summary=input_summary[:500] if input_summary else "",
                success=success,
                error_message=error_message[:500] if error_message else None,
                duration_ms=duration_ms,
                session_id=session_id,
                sub_queries=_json.dumps(sub_queries) if sub_queries else None,
                data_destination=data_destination,
            )
        )
        db.commit()
    except Exception as exc:
        logger.warning("Failed to write tool log for '%s': %s", tool_name, exc)
        try:
            db.rollback()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Synchronous context manager
# ---------------------------------------------------------------------------

@contextmanager
def timed_tool(
    db: Session,
    tool_name: str,
    input_summary: str = "",
    session_id: str | None = None,
    data_destination: str | None = None,
) -> Iterator[None]:
    """
    Context manager that records timing + success/failure for synchronous tools.

    Usage::

        with timed_tool(db, "weather", "location=Pittsburgh"):
            data = weather_client.get_current(location)
    """
    start = time.monotonic()
    try:
        yield
        elapsed = int((time.monotonic() - start) * 1000)
        log_tool_call(
            db, tool_name, input_summary,
            success=True, duration_ms=elapsed,
            session_id=session_id, data_destination=data_destination,
        )
    except Exception as exc:
        elapsed = int((time.monotonic() - start) * 1000)
        log_tool_call(
            db, tool_name, input_summary,
            success=False, error_message=str(exc), duration_ms=elapsed,
            session_id=session_id, data_destination=data_destination,
        )
        raise


# ---------------------------------------------------------------------------
# Async context manager
# ---------------------------------------------------------------------------

@asynccontextmanager
async def async_timed_tool(
    db: Session,
    tool_name: str,
    input_summary: str = "",
    session_id: str | None = None,
    data_destination: str | None = None,
) -> AsyncIterator[None]:
    """
    Async context manager that records timing + success/failure.

    Usage::

        async with async_timed_tool(db, "web_search", f"query={query!r}"):
            results = await web_search_client.search(query)
    """
    start = time.monotonic()
    try:
        yield
        elapsed = int((time.monotonic() - start) * 1000)
        log_tool_call(
            db, tool_name, input_summary,
            success=True, duration_ms=elapsed,
            session_id=session_id, data_destination=data_destination,
        )
    except Exception as exc:
        elapsed = int((time.monotonic() - start) * 1000)
        log_tool_call(
            db, tool_name, input_summary,
            success=False, error_message=str(exc), duration_ms=elapsed,
            session_id=session_id, data_destination=data_destination,
        )
        raise
