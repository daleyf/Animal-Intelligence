"""
Research endpoint.

POST /research  → SSE stream of research steps + cited answer + sources

SSE event types:
  {"type": "status",  "message": "Formulating queries…"}
  {"type": "token",   "content": "…"}
  {"type": "done",    "full_content": "…", "sources": [...]}
  {"type": "error",   "message": "…"}
"""

import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import get_db, get_ollama
from core.ollama_client import OllamaClient
from core.research_agent import ResearchAgent
from core.web_search import web_search_client
from core.tool_logger import log_tool_call
from core.pii_sanitizer import sanitize as pii_sanitize
from db.crud import settings as settings_crud
from db.crud import profile as profile_crud

router = APIRouter()


class ResearchRequest(BaseModel):
    question: str
    model: str | None = None


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


@router.post("/research")
async def research(
    request: ResearchRequest,
    db: Session = Depends(get_db),
    ollama: OllamaClient = Depends(get_ollama),
) -> StreamingResponse:
    """Stream a research session for the given question."""
    active_model = request.model or settings_crud.get_value(
        db, "active_model", "llama3.1:8b"
    )

    # Sanitize the question before logging — strip PII using profile data
    profile = profile_crud.get_profile(db)
    sanitized_question, _changed = pii_sanitize(
        request.question,
        name=getattr(profile, "name", None),
        home_location=getattr(profile, "home_location", None),
        work_location=getattr(profile, "work_location", None),
    )

    agent = ResearchAgent(ollama=ollama, search=web_search_client)

    async def event_stream() -> AsyncIterator[str]:
        success = False
        try:
            async for event in agent.conduct_research(
                question=request.question,
                model=active_model,
            ):
                if event.type == "token":
                    yield _sse({"type": "token", "content": event.content})
                elif event.type == "done":
                    success = True
                    log_tool_call(
                        db, "web_search",
                        input_summary=f"question={sanitized_question[:200]!r}",
                        success=True,
                    )
                    yield _sse({
                        "type": "done",
                        "full_content": event.full_content,
                        "sources": event.sources,
                    })
                elif event.type == "error":
                    log_tool_call(
                        db, "web_search",
                        input_summary=f"question={sanitized_question[:200]!r}",
                        success=False, error_message=event.message,
                    )
                    yield _sse({"type": "error", "message": event.message})
                    return
                else:
                    yield _sse({"type": "status", "message": event.message})
        except Exception as exc:
            if not success:
                log_tool_call(
                    db, "web_search",
                    input_summary=f"question={sanitized_question[:200]!r}",
                    success=False, error_message=str(exc),
                )
            yield _sse({"type": "error", "message": f"Research failed: {exc}"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
