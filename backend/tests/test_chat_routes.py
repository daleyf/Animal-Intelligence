"""
Chat Routes Tests

These tests use an in-memory SQLite DB and a mock Ollama client so no real
Ollama process is required.
"""

import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.models import Base, AppSettings
from db.database import DEFAULT_SETTINGS


# Shared fixtures
# -------------- #
@pytest.fixture(scope="module")
def test_db_engine():
    """Create an in-memory SQLite engine and initialize schema."""
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
# -------------- #
# server is healthy and can connect to Ollama
def test_health_endpoint(client):
    """Health endpoint should return status, version, and Ollama connectivity."""
    resp = client.get("/health")
    assert resp.status_code == 200

    # Check for expected fields in the response
    data = resp.json()

    assert data["status"] == "ok"
    assert "version" in data
    assert "ollama_connected" in data


# /api/v1/chat
# -------------- #
# chat endpoint successfully creates a conversation and returns stream tokens, including conversation_id.
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

# chat can continue an existing conversation using conversation_id from the first test, and returns a new stream with done event.
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

    # done conversation found, conversation_id should be present
    assert conv_id is not None

    with client.stream(
        "POST",
        "/api/v1/chat",
        json={"message": "Follow-up", "conversation_id": conv_id, "model": "test-model"},
    ) as resp:
        # If the conversation_id is valid, we should get a new stream of tokens followed by a done event.
        assert resp.status_code == 200
        raw2 = b"".join(resp.iter_bytes()).decode()

    # The second response should also contain token events and a done event.
    assert '"type": "token"' in raw2
    assert '"type": "done"' in raw2

# chat with an invalid conversation_id returns an error event.
def test_chat_invalid_conversation_id(client):
    """Non-existent conversation_id returns an error event."""
    with client.stream(
        "POST",
        "/api/v1/chat",
        json={"message": "Hi", "conversation_id": "nonexistent-uuid", "model": "test-model"},
    ) as resp:
        raw = b"".join(resp.iter_bytes()).decode()

    # with an invalid conversation_id, we expect an error field in the response.
    assert "error" in raw


# /api/v1/memory
# -------------- #
# memory list endpoint should return available flag for each memory, indicating if it's currently in use in a conversation.
def test_memory_list_returns_available_flag(client):
    """Memory list endpoint should return available flag for each memory."""
    resp = client.get("/api/v1/memory")
    assert resp.status_code == 200
    data = resp.json()
    assert "memories" in data
    assert "total" in data
    assert "available" in data
    # available should be less than or equal to total
    assert data["available"] <= data["total"]

# successfully count the number of memories and return an integer.
def test_memory_count(client):
    """Memory count endpoint should return an integer count."""
    resp = client.get("/api/v1/memory/count")
    assert resp.status_code == 200
    data = resp.json()
    assert "count" in data
    assert isinstance(data["count"], int)


# /api/v1/report
# -------------- #
# return correct status
def test_report_status(client):
    """Report status endpoint should return keys for weather, news, calendar, and calendar_configured."""
    resp = client.get("/api/v1/report/status")
    assert resp.status_code == 200
    data = resp.json()
    for key in ("weather", "news", "web_search", "calendar", "calendar_configured"):
        assert key in data

# the presence of API keys should correctly reflect in the status response.
def test_report_status_all_keys_absent(client):
    """weather, news, and web_search are all False when no API keys are configured."""
    with (
        patch("api.routes.report.weather_client") as mw,
        patch("api.routes.report.news_client") as mn,
        patch("api.routes.report.app_settings") as ms,
    ):
        mw.available = False
        mn.available = False
        ms.ollama_api_key = ""
        resp = client.get("/api/v1/report/status")

    data = resp.json()
    assert data["weather"] is False
    assert data["news"] is False
    assert data["web_search"] is False

# the presence of API keys should correctly reflect in the status response.
def test_report_status_weather_key_present(client):
    """weather is True when OPENWEATHERMAP_API_KEY is configured."""
    with (
        patch("api.routes.report.weather_client") as mw,
        patch("api.routes.report.news_client") as mn,
        patch("api.routes.report.app_settings") as ms,
    ):
        mw.available = True
        mn.available = False
        ms.ollama_api_key = ""
        resp = client.get("/api/v1/report/status")

    data = resp.json()
    assert data["weather"] is True
    assert data["news"] is False
    assert data["web_search"] is False

# the presence of API keys should correctly reflect in the status response.
def test_report_status_ollama_key_enables_news_and_web_search(client):
    """news and web_search are both True when OLLAMA_API_KEY is configured."""
    with (
        patch("api.routes.report.weather_client") as mw,
        patch("api.routes.report.news_client") as mn,
        patch("api.routes.report.app_settings") as ms,
    ):
        mw.available = False
        mn.available = True
        ms.ollama_api_key = "sk-test-key"
        resp = client.get("/api/v1/report/status")

    data = resp.json()
    assert data["weather"] is False
    assert data["news"] is True
    assert data["web_search"] is True

# all keys present should reflect as True in the status response.
def test_report_status_all_keys_present(client):
    """All integration flags are True when every key is configured."""
    with (
        patch("api.routes.report.weather_client") as mw,
        patch("api.routes.report.news_client") as mn,
        patch("api.routes.report.app_settings") as ms,
    ):
        mw.available = True
        mn.available = True
        ms.ollama_api_key = "sk-test-key"
        resp = client.get("/api/v1/report/status")

    data = resp.json()
    assert data["weather"] is True
    assert data["news"] is True
    assert data["web_search"] is True

# calendar_configured should reflect the calendar client's configured state.
def test_report_status_calendar_configured_true_when_credentials_set(client):
    """calendar_configured is True when calendar client is configured."""
    with patch("api.routes.report.calendar_client") as mc:
        mc.configured = True
        resp = client.get("/api/v1/report/status")

    assert resp.json()["calendar_configured"] is True

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_auth_no_config(client):
    """Without Google credentials, the auth endpoint returns an error field."""
    with patch("api.routes.report.calendar_client") as mc:
        mc.get_auth_url.side_effect = ValueError("Google OAuth credentials not configured.")
        resp = client.get("/api/v1/report/calendar/auth")

    assert resp.status_code == 200
    data = resp.json()
    assert "error" in data
    assert "auth_url" not in data

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_auth_returns_url_when_configured(client):
    fake_url = "https://accounts.google.com/o/oauth2/auth?client_id=fake"
    with patch("api.routes.report.calendar_client") as mc:
        mc.get_auth_url.return_value = fake_url
        resp = client.get("/api/v1/report/calendar/auth")

    assert resp.status_code == 200
    data = resp.json()
    assert data["auth_url"] == fake_url
    assert "error" not in data

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_callback_valid_code(client):
    """A valid auth code should be exchanged and mark the calendar as connected."""
    fake_token = {
        "access_token": "ya29.access",
        "refresh_token": "1//refresh",
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": "cid.apps.googleusercontent.com",
        "client_secret": "GOCSPX-secret",
        "scopes": "https://www.googleapis.com/auth/calendar.readonly",
    }
    with patch("api.routes.report.calendar_client") as mc:
        mc.exchange_code.return_value = fake_token
        resp = client.post("/api/v1/report/calendar/callback", json={"code": "4/0AX4XfWh"})

    assert resp.status_code == 200
    assert resp.json()["success"] is True
    assert client.get("/api/v1/report/status").json()["calendar"] is True

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_callback_invalid_code(client):
    """An invalid auth code should return success: False with the error message."""
    with patch("api.routes.report.calendar_client") as mc:
        mc.exchange_code.side_effect = Exception("invalid_grant")
        resp = client.post("/api/v1/report/calendar/callback", json={"code": "bad"})

    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is False
    assert "invalid_grant" in data["error"]

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_callback_missing_code_rejected(client):
    resp = client.post("/api/v1/report/calendar/callback", json={})
    assert resp.status_code == 422

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_disconnect(client):
    """Disconnect clears the connected flag and returns disconnected: True."""
    fake_token = {
        "access_token": "tok", "refresh_token": "ref",
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": "cid", "client_secret": "cs",
        "scopes": "https://www.googleapis.com/auth/calendar.readonly",
    }
    with patch("api.routes.report.calendar_client") as mc:
        mc.exchange_code.return_value = fake_token
        client.post("/api/v1/report/calendar/callback", json={"code": "c"})

    resp = client.delete("/api/v1/report/calendar")
    assert resp.status_code == 200
    assert resp.json()["disconnected"] is True
    assert client.get("/api/v1/report/status").json()["calendar"] is False

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_disconnect_idempotent(client):
    """Disconnecting when already disconnected should not error."""
    client.delete("/api/v1/report/calendar")
    resp = client.delete("/api/v1/report/calendar")
    assert resp.status_code == 200
    assert resp.json()["disconnected"] is True

# calendar_configured should reflect the calendar client's configured state.
def test_report_calendar_events_not_connected(client):
    """Events endpoint returns empty list and connected: False when not authenticated."""
    client.delete("/api/v1/report/calendar")
    resp = client.get("/api/v1/report/calendar/events")
    assert resp.status_code == 200
    data = resp.json()
    assert data["connected"] is False
    assert data["events"] == []


# /api/v1/conversations
# -------------- #
# when no conversations, endpoint should return an empty list of conversations.
def test_list_conversations_empty():
    """When no conversations exist, should return an empty list."""
    from main import app
    from api.dependencies import get_db, get_ollama
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    with SessionLocal() as s:
        for key, value in DEFAULT_SETTINGS.items():
            if s.get(AppSettings, key) is None:
                s.add(AppSettings(key=key, value=value))
        s.commit()

    def override_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_ollama] = lambda: None

    with TestClient(app, raise_server_exceptions=False) as c:
        resp = c.get("/api/v1/conversations")

    app.dependency_overrides.clear()
    engine.dispose()

    assert resp.status_code == 200
    data = resp.json()
    assert "conversations" in data
    assert data["conversations"] == []

# deleting a non-existent conversation should return a 404 error.
def test_delete_nonexistent_conversation(client):
    """Deleting a non-existent conversation should return 404."""
    resp = client.delete("/api/v1/conversations/not-a-real-id")
    # non-existent conversation should return 404
    assert resp.status_code == 404
