"""
Activity log routes.

Exposes the append-only tool_logs table for the transparency UI.

GET  /activity             → paginated tool log entries (newest first)
DELETE /activity           → clear all log entries
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, delete
from sqlalchemy.orm import Session

from api.dependencies import get_db
from db.models import ToolLog

router = APIRouter()


def _log_to_dict(row: ToolLog) -> dict:
    return {
        "id": row.id,
        "tool_name": row.tool_name,
        "input_summary": row.input_summary,
        "success": row.success,
        "error_message": row.error_message,
        "duration_ms": row.duration_ms,
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


@router.get("/activity")
def list_activity(
    db: Session = Depends(get_db),
    tool_name: Optional[str] = Query(None, description="Filter by tool name"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Return tool log entries, newest first."""
    stmt = select(ToolLog).order_by(ToolLog.created_at.desc())

    if tool_name:
        stmt = stmt.where(ToolLog.tool_name == tool_name)

    total_stmt = select(func.count()).select_from(stmt.subquery())
    total = db.scalar(total_stmt) or 0

    rows = db.scalars(stmt.offset(offset).limit(limit)).all()

    return {
        "logs": [_log_to_dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.delete("/activity")
def clear_activity(db: Session = Depends(get_db)):
    """Delete all tool log entries."""
    result = db.execute(delete(ToolLog))
    db.commit()
    return {"deleted": result.rowcount}
