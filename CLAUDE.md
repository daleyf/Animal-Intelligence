# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend

```bash
cd backend
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Run server
uvicorn main:app --reload --port 8000

# Run all tests
pytest

# Run a single test file
pytest tests/test_crud.py

# Run a single test by name
pytest tests/test_crud.py::TestConversationCrud::test_create_conversation

# Lint
flake8 .

# Format
black .
```

### Frontend

```bash
cd frontend

npm run dev        # dev server at http://localhost:5173
npm run build      # production build
npm run lint       # ESLint
npx tsc --noEmit   # type check without emitting files
```

### Prerequisite: Ollama

```bash
ollama serve                # must be running at localhost:11434
ollama pull llama3.1:8b    # pull at least one model
```

## Architecture

Anchorpoint is a **privacy-first local LLM assistant**: all inference runs via Ollama on the user's device, no data leaves the machine. The frontend never calls tools directly — all LLM and tool interactions go through the FastAPI backend.

### Request Flow

```
Browser (React)
  → fetch POST /api/v1/chat  (SSE stream)
  → FastAPI chat route
    → build_system_prompt() + build_context_messages()  [prompt_builder.py]
    → OllamaClient.stream_chat()                        [ollama_client.py]
    → SQLite via CRUD layer                             [db/crud/]
```

### Backend layers (`backend/`)

| Layer | Path | Purpose |
|---|---|---|
| Entry point | `main.py` | FastAPI app, CORS, lifespan (init DB + close Ollama client) |
| Config | `core/config.py` | pydantic-settings reading from `.env` |
| Ollama client | `core/ollama_client.py` | **Singleton** `httpx.AsyncClient`. All Ollama calls go here: `stream_chat()`, `pull_model()`, `list_installed_models()`, `is_running()` |
| Prompt builder | `core/prompt_builder.py` | `build_system_prompt()` (injects profile data), `build_context_messages()` (token-budget truncation, newest-first) |
| DB models | `db/models.py` | SQLAlchemy ORM: `Conversation`, `Message`, `UserProfile` (single row, id=1), `AppSettings` (key-value) |
| DB init | `db/database.py` | `init_db()` creates tables and seeds default `AppSettings` keys |
| CRUD | `db/crud/` | `conversations.py`, `profile.py`, `settings.py` — no raw SQL anywhere outside these modules |
| Routes | `api/routes/` | `chat.py` (SSE), `conversations.py`, `models.py`, `profile.py`, `settings.py`, `memory.py`, `report.py`, `voice.py`, `activity.py`, `search.py` |

### SSE Chat Protocol

`POST /api/v1/chat` returns `text/event-stream`. Each line is `data: <json>\n\n`:

```
{"type": "conversation_id", "conversation_id": "uuid"}   # sent first
{"type": "token", "content": "Hello"}                    # one per token
{"type": "done", "full_content": "...", "token_count": N, "conversation_id": "uuid"}
{"type": "error", "message": "Cannot connect to Ollama"}
```

The frontend uses `fetch` + `ReadableStream` (not `EventSource`, which is GET-only).

### Frontend layers (`frontend/src/`)

| Layer | Path | Purpose |
|---|---|---|
| Global state | `store/appStore.ts` | Zustand: `activeConversationId`, `activeModel`, `isGenerating`, `abortController`, `ollamaConnected` — no research/report panel state; those pages manage their own local state |
| Server state | `hooks/use*.ts` | TanStack Query hooks wrapping `api/` fetch helpers |
| SSE client | `api/chat.ts` | `streamChat()` parses SSE lines and fires callbacks |
| Routing | `App.tsx` | `BrowserRouter` with onboarding check; routes: `/`, `/research`, `/report`, `/activity`, `/settings/*` |

### Key design constraints

- **`httpx.AsyncClient` is a module-level singleton** in `ollama_client.py` — do not create per-request instances.
- **SQLite requires `check_same_thread=False`** (already set in `db/database.py`) because FastAPI is async.
- **SSE `StreamingResponse` must set `X-Accel-Buffering: no`** to prevent nginx buffering (set in `chat.py`).
- **Conversations use soft-delete** (`is_deleted` flag). All `GET` queries filter `WHERE is_deleted = false`. `hard_delete_all_conversations()` exists for "clear all history".
- **Auto-title** runs as a `BackgroundTasks` task after the first exchange — it never blocks the SSE stream.
- **Token estimation**: `int(len(text.split()) * 1.3) + 1` — fast approximation used for context window budget.
- **Personalization**: rebuilt on every request from the `UserProfile` row and `personalization_enabled` setting; not cached.

### AppSettings seed keys

`db/database.py` seeds these on first launch:

| Key | Default | Notes |
|---|---|---|
| `active_model` | `llama3.1:8b` | |
| `personalization_enabled` | `true` | |
| `context_window_tokens` | `4096` | |
| `report_schedule_enabled` | `false` | Daily report auto-generation toggle |
| `morning_report_time` | `07:00` | UTC time for scheduled report |
| `last_report_content` | `""` | Cached content of most recent report |
| `last_report_generated_at` | `""` | ISO timestamp of most recent report |

### Conversation types

`Conversation.conversation_type` is an enum-style string with three values:

| Value | Created by | Notes |
|---|---|---|
| `"chat"` | `POST /api/v1/chat` | Standard chat |
| `"research"` | `GET /api/v1/memory/research` SSE | Web research results |
| `"report"` | `GET /report` SSE | Daily report; also writes to `last_report_content` |

Factory reset (`POST /reset`) hard-deletes all conversation types and clears the report cache keys.

### Linting / formatting standards

- Python: `black` (line length 100) + `flake8` (ignores E203, W503)
- TypeScript: ESLint (config in `.eslintrc.cjs`)
- pytest runs with `asyncio_mode = "auto"` (no `@pytest.mark.asyncio` needed)
- Backend tests use in-memory SQLite (`sqlite:///:memory:`)

### Feature overview

- **Core chat**: streaming SSE, conversation persistence, model management, onboarding, personalization
- **Memory**: ChromaDB vector memory, context injection from past conversations
- **Research**: full-page route at `/research` — web research agent with Ollama Web Search API; results stream into a chat-style thread with cited sources; follow-up questions use regular chat after initial research completes
- **Daily Report**: weather, news, Google Calendar summary; each generation creates a `conversation_type="report"` conversation stored in the sidebar; follow-up chat is supported after generation; scheduled auto-generation (enabled/time in **General Settings**)
- **Voice**: browser TTS, built-in and custom voice profiles
- **Activity Logs**: tool invocation audit trail at `/activity`
- **Security**: PII sanitization on outbound queries, Fernet encryption for OAuth tokens at rest
