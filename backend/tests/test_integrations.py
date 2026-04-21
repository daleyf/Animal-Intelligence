"""
Integration tests:
voice, activity log, report schedule, tool logger, and external API failure scenarios.

using an in-memory SQLite database.
"""

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.models import Base, AppSettings
from db.database import DEFAULT_SETTINGS


# Shared fixtures

@pytest.fixture(scope="module")
def test_db_engine():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as s:
        for key, value in DEFAULT_SETTINGS.items():
            if s.get(AppSettings, key) is None:
                s.add(AppSettings(key=key, value=value))
        s.commit()
    yield engine
    engine.dispose()


@pytest.fixture
def client(test_db_engine):
    from main import app
    from api.dependencies import get_db, get_ollama

    SessionLocal = sessionmaker(bind=test_db_engine)

    class _FakeOllama:
        async def stream_chat(self, model, messages, system_prompt=""):
            for token in ["Good", " ", "morning", "!"]:
                yield token

        async def is_running(self):
            return True

    def override_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_ollama] = _FakeOllama

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()


# Voice routes

def test_voice_profiles(client):
    resp = client.get("/api/v1/voice/profiles")
    assert resp.status_code == 200
    data = resp.json()
    assert "profiles" in data
    profiles = data["profiles"]
    assert len(profiles) == 3
    ids = {p["id"] for p in profiles}
    assert ids == {"neutral", "warm", "professional"}
    for p in profiles:
        assert "rate" in p and "pitch" in p and "name" in p


def test_voice_settings_get(client):
    resp = client.get("/api/v1/voice/settings")
    assert resp.status_code == 200
    data = resp.json()
    assert "enabled" in data
    assert "profile" in data
    assert "rate" in data
    assert "pitch" in data
    assert isinstance(data["rate"], float)


def test_voice_settings_update_toggle(client):
    resp = client.put("/api/v1/voice/settings", json={"enabled": True})
    assert resp.status_code == 200
    assert resp.json()["enabled"] is True

    resp = client.put("/api/v1/voice/settings", json={"enabled": False})
    assert resp.json()["enabled"] is False


def test_voice_settings_select_profile(client):
    resp = client.put("/api/v1/voice/settings", json={"profile": "warm"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"] == "warm"
    # Synced rate/pitch from profile
    assert data["rate"] == pytest.approx(0.9, abs=0.01)
    assert data["pitch"] == pytest.approx(1.15, abs=0.01)


def test_voice_settings_fine_tune(client):
    resp = client.put("/api/v1/voice/settings", json={"rate": 1.25, "pitch": 0.8})
    assert resp.status_code == 200
    data = resp.json()
    assert data["rate"] == pytest.approx(1.25, abs=0.01)
    assert data["pitch"] == pytest.approx(0.8, abs=0.01)


def test_voice_settings_invalid_profile(client):
    resp = client.put("/api/v1/voice/settings", json={"profile": "robot"})
    assert resp.status_code == 422  # Pydantic validation error


def test_voice_settings_rate_out_of_range(client):
    resp = client.put("/api/v1/voice/settings", json={"rate": 5.0})
    assert resp.status_code == 422


# Activity log routes

def test_activity_list_empty(client):
    # Clean slate
    client.delete("/api/v1/activity")
    resp = client.get("/api/v1/activity")
    assert resp.status_code == 200
    data = resp.json()
    assert "logs" in data
    assert "total" in data
    assert isinstance(data["logs"], list)


def test_activity_log_written_by_tool_logger(client, test_db_engine):
    """Write a log entry via the tool_logger and verify it appears in the API."""
    from core.tool_logger import log_tool_call
    from sqlalchemy.orm import sessionmaker as sm

    db = sm(bind=test_db_engine)()
    try:
        log_tool_call(db, "weather", input_summary="location=Pittsburgh", success=True, duration_ms=120)
    finally:
        db.close()

    resp = client.get("/api/v1/activity?tool_name=weather")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    entry = next(e for e in data["logs"] if e["tool_name"] == "weather")
    assert entry["success"] is True
    assert "Pittsburgh" in (entry["input_summary"] or "")
    assert entry["duration_ms"] == 120


def test_activity_filter_by_tool(client, test_db_engine):
    from core.tool_logger import log_tool_call
    from sqlalchemy.orm import sessionmaker as sm

    db = sm(bind=test_db_engine)()
    try:
        log_tool_call(db, "news", input_summary="categories=tech", success=False, error_message="API key missing")
    finally:
        db.close()

    resp = client.get("/api/v1/activity?tool_name=news")
    assert resp.status_code == 200
    data = resp.json()
    assert all(e["tool_name"] == "news" for e in data["logs"])
    failed = next(e for e in data["logs"] if not e["success"])
    assert failed["error_message"] == "API key missing"


def test_activity_clear(client, test_db_engine):
    from core.tool_logger import log_tool_call
    from sqlalchemy.orm import sessionmaker as sm

    db = sm(bind=test_db_engine)()
    try:
        log_tool_call(db, "weather", input_summary="location=home", success=True)
    finally:
        db.close()

    resp = client.delete("/api/v1/activity")
    assert resp.status_code == 200
    assert resp.json()["deleted"] >= 1

    resp = client.get("/api/v1/activity")
    assert resp.json()["total"] == 0


# Report schedule routes
def test_report_schedule_get(client):
    resp = client.get("/api/v1/report/schedule")
    assert resp.status_code == 200
    data = resp.json()
    assert "enabled" in data
    assert "time" in data
    assert isinstance(data["enabled"], bool)


def test_report_schedule_update(client):
    resp = client.put("/api/v1/report/schedule", json={"enabled": True, "time": "08:30"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["enabled"] is True
    assert data["time"] == "08:30"

    # Verify persisted
    resp2 = client.get("/api/v1/report/schedule")
    assert resp2.json()["time"] == "08:30"
    assert resp2.json()["enabled"] is True

    # Disable
    client.put("/api/v1/report/schedule", json={"enabled": False, "time": "08:30"})


def test_report_latest(client):
    resp = client.get("/api/v1/report/latest")
    assert resp.status_code == 200
    data = resp.json()
    assert "content" in data
    assert "generated_at" in data


# Tool logger unit tests
def test_tool_logger_success(test_db_engine):
    from core.tool_logger import log_tool_call
    from db.models import ToolLog
    from sqlalchemy.orm import sessionmaker as sm
    from sqlalchemy import select

    db = sm(bind=test_db_engine)()
    try:
        log_tool_call(db, "memory", "query=test query", success=True, duration_ms=45)
        rows = db.scalars(select(ToolLog).where(ToolLog.tool_name == "memory")).all()
        assert len(rows) >= 1
        row = next(r for r in rows if r.duration_ms == 45)
        assert row.success is True
        assert row.input_summary == "query=test query"
    finally:
        db.close()


def test_tool_logger_failure(test_db_engine):
    from core.tool_logger import log_tool_call
    from db.models import ToolLog
    from sqlalchemy.orm import sessionmaker as sm
    from sqlalchemy import select

    db = sm(bind=test_db_engine)()
    try:
        log_tool_call(
            db, "calendar", "fetch_events",
            success=False, error_message="Token expired", duration_ms=200,
        )
        rows = db.scalars(select(ToolLog).where(ToolLog.tool_name == "calendar")).all()
        failed = next(r for r in rows if not r.success)
        assert failed.error_message == "Token expired"
    finally:
        db.close()


def test_tool_logger_truncates_long_input(test_db_engine):
    from core.tool_logger import log_tool_call
    from db.models import ToolLog
    from sqlalchemy.orm import sessionmaker as sm
    from sqlalchemy import select

    long_input = "x" * 1000
    db = sm(bind=test_db_engine)()
    try:
        log_tool_call(db, "web_search", long_input, success=True)
        rows = db.scalars(select(ToolLog).where(ToolLog.tool_name == "web_search")).all()
        row = max(rows, key=lambda r: r.created_at or "")
        assert len(row.input_summary) <= 500
    finally:
        db.close()


# API failures

def test_web_search_no_api_key_returns_empty():
    """When OLLAMA_API_KEY is empty, search() returns [] without raising."""
    import asyncio
    from unittest.mock import patch
    from core.web_search import WebSearchClient

    async def _run():
        client = WebSearchClient()
        with patch("core.web_search.settings") as mock_settings:
            mock_settings.ollama_api_key = ""
            results = await client.search("Python")
        await client.aclose()
        return results

    results = asyncio.get_event_loop().run_until_complete(_run())
    assert results == []


def test_web_search_connection_error_returns_empty():
    """When the Ollama API is unreachable, search() logs and returns [] gracefully."""
    import asyncio
    from unittest.mock import patch, AsyncMock
    from core.web_search import WebSearchClient

    async def _run():
        client = WebSearchClient()
        with patch("core.web_search.settings") as mock_settings:
            mock_settings.ollama_api_key = "test-key"
            # Simulate a network error on the POST call
            client._http.post = AsyncMock(side_effect=httpx.ConnectError("refused"))
            results = await client.search("Python")
        await client.aclose()
        return results

    results = asyncio.get_event_loop().run_until_complete(_run())
    assert results == []


def test_fetch_content_no_api_key_returns_empty():
    """fetch_content() returns '' when OLLAMA_API_KEY is unset — never raises."""
    import asyncio
    from unittest.mock import patch
    from core.web_search import WebSearchClient

    async def _run():
        client = WebSearchClient()
        with patch("core.web_search.settings") as mock_settings:
            mock_settings.ollama_api_key = ""
            content = await client.fetch_content("https://example.com/page")
        await client.aclose()
        return content

    content = asyncio.get_event_loop().run_until_complete(_run())
    assert content == ""


@pytest.mark.asyncio
async def test_timed_tool_context_manager_records_success(test_db_engine):
    from core.tool_logger import async_timed_tool
    from db.models import ToolLog
    from sqlalchemy.orm import sessionmaker as sm
    from sqlalchemy import select

    db = sm(bind=test_db_engine)()
    try:
        async with async_timed_tool(db, "test_tool", "input=hello"):
            pass  # Simulated tool work

        rows = db.scalars(select(ToolLog).where(ToolLog.tool_name == "test_tool")).all()
        assert any(r.success for r in rows)
    finally:
        db.close()


@pytest.mark.asyncio
async def test_timed_tool_context_manager_records_failure(test_db_engine):
    from core.tool_logger import async_timed_tool
    from db.models import ToolLog
    from sqlalchemy.orm import sessionmaker as sm
    from sqlalchemy import select

    db = sm(bind=test_db_engine)()
    try:
        with pytest.raises(ValueError):
            async with async_timed_tool(db, "test_tool_fail", "input=bad"):
                raise ValueError("simulated failure")

        rows = db.scalars(select(ToolLog).where(ToolLog.tool_name == "test_tool_fail")).all()
        assert any(not r.success and r.error_message == "simulated failure" for r in rows)
    finally:
        db.close()
