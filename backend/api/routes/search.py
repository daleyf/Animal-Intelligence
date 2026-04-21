"""
Research endpoint.

POST /research  → SSE stream of research steps + cited answer + sources

SSE event types:
  {"type": "conversation_id", "conversation_id": "uuid"}  # sent first
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
from db.crud import conversations as conv_crud

router = APIRouter()


class ResearchRequest(BaseModel):
    question: str
    model: str | None = None


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _generate_title(
    conversation_id: str,
    question: str,
    model: str,
    ollama: OllamaClient,
    db: Session,
) -> None:
    """Generate a short title and save it to the DB."""
    prompt = (
        f"Generate a short 4-6 word title for a research session about:\n"
        f'"{question[:300]}"\n\n'
        f"Reply with only the title — no quotes, no punctuation at the end."
    )
    tokens: list[str] = []
    try:
        async for token in ollama.stream_chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            system_prompt="",
        ):
            tokens.append(token)
            if len(tokens) > 50:
                break
        title = "".join(tokens).strip()[:120]
        if title:
            conv_crud.update_title(db, conversation_id, title)
    except Exception:
        pass  # Title generation is best-effort; never raise


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

    # Create a conversation row upfront so we can emit its id in the first SSE event
    convo = conv_crud.create_conversation(db, model_name=active_model, conversation_type="research")

    agent = ResearchAgent(ollama=ollama, search=web_search_client)

    async def event_stream() -> AsyncIterator[str]:
        # Emit conversation_id first so the client can link follow-up messages
        yield _sse({"type": "conversation_id", "conversation_id": convo.id})

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

                    # Persist the exchange so it appears in conversation history
                    conv_crud.add_message(db, convo.id, "user", request.question)
                    conv_crud.add_message(
                        db, convo.id, "assistant", event.full_content,
                        extra_data={"sources": event.sources} if event.sources else None,
                    )

                    # Generate title inline so sidebar sees it immediately when queries invalidate
                    await _generate_title(convo.id, request.question, active_model, ollama, db)

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
                    # Remove the placeholder conversation — nothing was saved
                    conv_crud.soft_delete_conversation(db, convo.id)
                    log_tool_call(
                        db, "web_search",
                        input_summary=f"question={sanitized_question[:200]!r}",
                        success=False, error_message=event.message,
                    )
                    yield _sse({"type": "error", "message": event.message})
                    return
                else:
                    # status event — relay as-is
                    yield _sse({"type": "status", "message": event.message})
        except Exception as exc:
            conv_crud.soft_delete_conversation(db, convo.id)
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
