"""
Anchorpoint Backend — FastAPI application entry point.

All routes are prefixed with /api/v1 except the /health check.
The UI must NEVER call tools directly — everything goes through this API layer.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import settings
from core.ollama_client import ollama_client
from db.database import init_db, SessionLocal
from db.crud import settings as settings_crud

from api.routes.chat import router as chat_router
from api.routes.conversations import router as conversations_router
from api.routes.models import router as models_router
from api.routes.profile import router as profile_router
from api.routes.settings import router as settings_router
from api.routes.memory import router as memory_router
from api.routes.report import router as report_router
from api.routes.search import router as search_router
from api.routes.voice import router as voice_router
from api.routes.activity import router as activity_router

VERSION = "0.4.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()

    # Start background scheduler with saved settings
    from core.scheduler import report_scheduler
    db = SessionLocal()
    try:
        enabled = settings_crud.get_value(db, "report_schedule_enabled", "false") == "true"
        time_str = settings_crud.get_value(db, "morning_report_time", "07:00")
    finally:
        db.close()
    report_scheduler.start(enabled=enabled, time_str=time_str)

    yield

    # Shutdown
    report_scheduler.shutdown()
    await ollama_client.aclose()


app = FastAPI(
    title="Anchorpoint",
    description="Privacy-first local LLM assistant API",
    version=VERSION,
    lifespan=lifespan,
)

# CORS — allow the Vite dev server to call the API.
# In production (Electron), frontend and backend share the same origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────

PREFIX = "/api/v1"

app.include_router(chat_router, prefix=PREFIX, tags=["Chat"])
app.include_router(conversations_router, prefix=PREFIX, tags=["Conversations"])
app.include_router(models_router, prefix=PREFIX, tags=["Models"])
app.include_router(profile_router, prefix=PREFIX, tags=["Profile"])
app.include_router(settings_router, prefix=PREFIX, tags=["Settings"])
app.include_router(memory_router, prefix=PREFIX, tags=["Memory"])
app.include_router(report_router, prefix=PREFIX, tags=["Report"])
app.include_router(search_router, prefix=PREFIX, tags=["Research"])
app.include_router(voice_router, prefix=PREFIX, tags=["Voice"])
app.include_router(activity_router, prefix=PREFIX, tags=["Activity"])


@app.get("/health", tags=["Health"])
async def health_check():
    """Check API and Ollama connectivity."""
    ollama_ok = await ollama_client.is_running()
    return {
        "status": "ok",
        "version": VERSION,
        "ollama_connected": ollama_ok,
    }
