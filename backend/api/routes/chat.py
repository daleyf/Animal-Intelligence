"""
POST /chat — SSE streaming chat endpoint.

Flow:
1. Get or create a Conversation row.
2. Send conversation_id to the frontend immediately (for new conversations).
3. Build system prompt (with personalization if enabled).
4. Retrieve relevant memories and inject into context (if memory enabled).
5. Build context messages (with token budget truncation).
6. Stream tokens from Ollama, forwarding each as an SSE event.
7. Save user + assistant messages to the DB after streaming.
8. Store the exchange in vector memory (background).
9. Fire a background task to auto-title the conversation on its first exchange.
"""

import json
from typing import AsyncIterator

from fastapi import APIRouter, BackgroundTasks, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import get_db, get_ollama
from core.memory_store import memory_store
from core.ollama_client import OllamaClient
from core.prompt_builder import build_system_prompt, build_context_messages, estimate_tokens
from db.crud import conversations as conv_crud
from db.crud import profile as profile_crud
from db.crud import settings as settings_crud

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    model: str | None = None
    stream: bool = True


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _generate_title(
    conversation_id: str,
    first_user_message: str,
    model: str,
    ollama: OllamaClient,
    db: Session,
) -> None:
    """Background task: ask the LLM to generate a short title."""
    prompt = (
        f"Generate a short 4-6 word title for a conversation that starts with:\n"
        f'"{first_user_message[:300]}"\n\n'
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
            if len(tokens) > 50:  # safety cap
                break
        title = "".join(tokens).strip()[:120]
        if title:
            conv_crud.update_title(db, conversation_id, title)
    except Exception:
        pass  # Title generation is best-effort; never raise


def _store_memory_bg(
    user_message: str,
    assistant_response: str,
    conversation_id: str,
) -> None:
    """Background task: persist exchange to vector memory store."""
    try:
        memory_store.store_memory(user_message, assistant_response, conversation_id)
    except Exception:
        pass  # Memory storage is best-effort; never raise


def _build_memory_context(user_message: str, memory_enabled: bool) -> str:
    """
    Retrieve semantically relevant past memories and format them as context text.

    Returns an empty string if memory is disabled or no relevant memories found.
    """
    if not memory_enabled or not memory_store.available:
        return ""

    memories = memory_store.retrieve_relevant(user_message, n_results=3)
    if not memories:
        return ""

    # Only include memories with decent relevance (cosine similarity > 0.5)
    relevant = [m for m in memories if m.distance < 0.5]
    if not relevant:
        return ""

    lines = ["Relevant context from past conversations:"]
    for m in relevant:
        ts = m.metadata.get("timestamp", "")[:10]  # YYYY-MM-DD
        user_msg = m.metadata.get("user_message", "")
        asst_msg = m.metadata.get("assistant_response", "")
        lines.append(f"[{ts}] {user_msg} → {asst_msg}")
    return "\n".join(lines)


@router.post("/chat")
async def chat(
    request: ChatRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    ollama: OllamaClient = Depends(get_ollama),
) -> StreamingResponse:
    active_model = request.model or settings_crud.get_value(
        db, "active_model", "llama3.1:8b"
    )
    memory_enabled = (
        settings_crud.get_value(db, "memory_enabled", "true") == "true"
    )

    async def event_stream() -> AsyncIterator[str]:
        # -- Step 1: get or create conversation --
        is_new_conversation = request.conversation_id is None
        if is_new_conversation:
            convo = conv_crud.create_conversation(db, model_name=active_model)
        else:
            convo = conv_crud.get_conversation(db, request.conversation_id)
            if convo is None:
                yield _sse({"type": "error", "message": "Conversation not found."})
                return

        yield _sse({"type": "conversation_id", "conversation_id": convo.id})

        # -- Step 2: build system prompt --
        personalization_on = (
            settings_crud.get_value(db, "personalization_enabled", "true") == "true"
        )
        profile = profile_crud.get_profile(db)
        system_prompt = build_system_prompt(profile, personalization_on)

        # -- Step 3: inject memory context --
        memory_context = _build_memory_context(request.message, memory_enabled)
        if memory_context:
            system_prompt = f"{system_prompt}\n\n{memory_context}"

        max_tokens = int(
            settings_crud.get_value(db, "context_window_tokens", "4096") or "4096"
        )

        history = conv_crud.get_messages(db, convo.id)
        context, _ctx_stats = build_context_messages(history, system_prompt, max_tokens)
        context.append({"role": "user", "content": request.message})

        # -- Step 4: stream from Ollama --
        collected_tokens: list[str] = []
        try:
            async for token in ollama.stream_chat(
                model=active_model,
                messages=context,
                system_prompt=system_prompt,
            ):
                collected_tokens.append(token)
                yield _sse({"type": "token", "content": token})
        except ConnectionError as exc:
            yield _sse({"type": "error", "message": str(exc)})
            return
        except TimeoutError as exc:
            yield _sse({"type": "error", "message": str(exc)})
            return
        except ValueError as exc:
            yield _sse({"type": "error", "message": str(exc)})
            return
        except Exception as exc:
            yield _sse({"type": "error", "message": f"Unexpected error: {exc}"})
            return

        # -- Step 5: persist messages --
        full_response = "".join(collected_tokens)
        token_count = estimate_tokens(full_response)

        conv_crud.add_message(db, convo.id, "user", request.message)
        conv_crud.add_message(db, convo.id, "assistant", full_response, token_count)

        yield _sse(
            {
                "type": "done",
                "full_content": full_response,
                "token_count": token_count,
                "conversation_id": convo.id,
            }
        )

        # -- Step 6: auto-title on first exchange --
        if is_new_conversation:
            background_tasks.add_task(
                _generate_title,
                convo.id,
                request.message,
                active_model,
                ollama,
                db,
            )

        # -- Step 7: store exchange in vector memory (background) --
        if memory_enabled and memory_store.available:
            background_tasks.add_task(
                _store_memory_bg,
                request.message,
                full_response,
                convo.id,
            )

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
