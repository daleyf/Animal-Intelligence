"""
Chat Routes Tests

These tests use an in-memory SQLite DB and a mock Ollama client so no real
Ollama process is required.
"""

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
    SessionLocal = sessionmaker(bind=engine)

    # Seed default settings
    with SessionLocal() as s:
        for key, value in DEFAULT_SETTINGS.items():
            if s.get(AppSettings, key) is None:
                s.add(AppSettings(key=key, value=value))
        s.commit()

    yield engine
    engine.dispose()


@pytest.fixture
def client(test_db_engine):
    """TestClient with DB and Ollama overridden."""
    from main import app
    from api.dependencies import get_db, get_ollama
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(bind=test_db_engine)

    class _FakeOllama:
        async def stream_chat(self, model, messages, system_prompt=""):
            for token in ["Hello", " ", "world", "!"]:
                yield token

        async def is_running(self):
            return True

    def override_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def override_ollama():
        return _FakeOllama()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_ollama] = override_ollama

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c

    app.dependency_overrides.clear()


# /health
def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "ollama_connected" in data


# /api/v1/chat
def test_chat_creates_conversation(client):
    """A new chat message should return a conversation_id and stream tokens."""
    with client.stream(
        "POST",
        "/api/v1/chat",
        json={"message": "Hello!", "model": "test-model"},
    ) as resp:
        assert resp.status_code == 200
        raw = b"".join(resp.iter_bytes()).decode()

    assert "conversation_id" in raw
    assert '"type": "token"' in raw
    assert '"type": "done"' in raw


def test_chat_continues_conversation(client):
    """Second message with existing conversation_id should succeed."""
    with client.stream(
        "POST",
        "/api/v1/chat",
        json={"message": "First message", "model": "test-model"},
    ) as resp:
        raw = b"".join(resp.iter_bytes()).decode()

    import json
    conv_id = None
    for line in raw.splitlines():
        if line.startswith("data: "):
            event = json.loads(line[6:])
            if event.get("type") == "done":
                conv_id = event.get("conversation_id")
                break

    assert conv_id is not None

    with client.stream(
        "POST",
        "/api/v1/chat",
        json={"message": "Follow-up", "conversation_id": conv_id, "model": "test-model"},
    ) as resp:
        assert resp.status_code == 200
        raw2 = b"".join(resp.iter_bytes()).decode()

    assert '"type": "done"' in raw2


def test_chat_invalid_conversation_id(client):
    """Non-existent conversation_id returns an error event."""
    with client.stream(
        "POST",
        "/api/v1/chat",
        json={"message": "Hi", "conversation_id": "nonexistent-uuid", "model": "test-model"},
    ) as resp:
        raw = b"".join(resp.iter_bytes()).decode()

    assert "error" in raw


# /api/v1/memory

def test_memory_list_returns_available_flag(client):
    resp = client.get("/api/v1/memory")
    assert resp.status_code == 200
    data = resp.json()
    assert "memories" in data
    assert "total" in data
    assert "available" in data


def test_memory_count(client):
    resp = client.get("/api/v1/memory/count")
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data
    assert isinstance(data["count"], int)


# /api/v1/report

def test_report_status(client):
    resp = client.get("/api/v1/report/status")
    assert resp.status_code == 200
    data = resp.json()
    for key in ("weather", "news", "calendar", "calendar_configured"):
        assert key in data


def test_report_calendar_auth_no_config(client):
    """Without Google credentials, auth URL endpoint returns an error field."""
    resp = client.get("/api/v1/report/calendar/auth")
    assert resp.status_code == 200
    data = resp.json()
    # Either auth_url (if configured) or error (if not configured)
    assert "auth_url" in data or "error" in data


# /api/v1/conversations

def test_list_conversations_empty(client):
    resp = client.get("/api/v1/conversations")
    assert resp.status_code == 200
    data = resp.json()
    assert "conversations" in data


def test_delete_nonexistent_conversation(client):
    resp = client.delete("/api/v1/conversations/not-a-real-id")
    assert resp.status_code == 404
