"""
Core Services Tests

using an in-memory SQLite database.
"""

import pytest
import httpx

from unittest.mock import AsyncMock, MagicMock
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
            for token in ["hi"]:
                yield token

        async def is_running(self):
            return True

        async def list_installed_models(self):
            return [{"name": "llama3.1:8b", "size": 4_700_000_000}]

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


# Ollama client tests

class TestOllamaClient:
    @pytest.mark.asyncio
    async def test_is_running_true_when_200(self):
        from core.ollama_client import OllamaClient

        oc = OllamaClient(base_url="http://localhost:11434")
        mock_response = MagicMock()
        mock_response.status_code = 200
        oc._client.get = AsyncMock(return_value=mock_response)

        result = await oc.is_running()
        assert result is True
        await oc.aclose()

    @pytest.mark.asyncio
    async def test_is_running_false_on_connect_error(self):
        from core.ollama_client import OllamaClient

        oc = OllamaClient(base_url="http://localhost:11434")
        oc._client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))

        result = await oc.is_running()
        assert result is False
        await oc.aclose()

    @pytest.mark.asyncio
    async def test_list_installed_models_parses_response(self):
        from core.ollama_client import OllamaClient

        oc = OllamaClient(base_url="http://localhost:11434")
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.raise_for_status = MagicMock()
        mock_response.json.return_value = {
            "models": [
                {"name": "llama3.1:8b", "size": 4_700_000_000},
                {"name": "mistral:7b", "size": 3_800_000_000},
            ]
        }
        oc._client.get = AsyncMock(return_value=mock_response)

        models = await oc.list_installed_models()
        assert any(m["name"] == "llama3.1:8b" for m in models)
        assert any(m["name"] == "mistral:7b" for m in models)
        await oc.aclose()

    @pytest.mark.asyncio
    async def test_list_installed_models_returns_empty_on_error(self):
        from core.ollama_client import OllamaClient

        oc = OllamaClient(base_url="http://localhost:11434")
        oc._client.get = AsyncMock(side_effect=httpx.ConnectError("refused"))

        models = await oc.list_installed_models()
        assert models == []
        await oc.aclose()

    def test_known_models_list_not_empty(self):
        from core.ollama_client import KNOWN_MODELS

        assert len(KNOWN_MODELS) > 0
        for m in KNOWN_MODELS:
            assert "name" in m
            assert "min_ram_gb" in m
            assert "size_gb" in m


# Settings route

class TestSettingsRoute:
    def test_get_settings_returns_defaults(self, client):
        resp = client.get("/api/v1/settings")
        assert resp.status_code == 200
        data = resp.json()
        assert "active_model" in data
        assert "personalization_enabled" in data
        assert "context_window_tokens" in data

    def test_update_settings_persists(self, client):
        resp = client.put("/api/v1/settings", json={"active_model": "mistral:7b"})
        assert resp.status_code == 200

        resp2 = client.get("/api/v1/settings")
        assert resp2.json()["active_model"] == "mistral:7b"

    def test_update_personalization_toggle(self, client):
        client.put("/api/v1/settings", json={"personalization_enabled": "false"})
        resp = client.get("/api/v1/settings")
        assert resp.json()["personalization_enabled"] == "false"

        client.put("/api/v1/settings", json={"personalization_enabled": "true"})

    def test_update_context_window(self, client):
        client.put("/api/v1/settings", json={"context_window_tokens": "8192"})
        resp = client.get("/api/v1/settings")
        assert resp.json()["context_window_tokens"] == "8192"

        client.put("/api/v1/settings", json={"context_window_tokens": "4096"})


# Profile route
class TestProfileRoute:
    def test_get_profile_returns_shape(self, client):
        resp = client.get("/api/v1/profile")
        assert resp.status_code == 200
        data = resp.json()
        assert "name" in data
        assert "onboarding_done" in data

    def test_update_profile_name(self, client):
        resp = client.put("/api/v1/profile", json={"name": "Alice", "onboarding_done": True})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Alice"
        assert data["onboarding_done"] is True

    def test_update_profile_locations(self, client):
        resp = client.put(
            "/api/v1/profile",
            json={"home_location": "Pittsburgh, PA", "work_location": "CMU Campus"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["home_location"] == "Pittsburgh, PA"
        assert data["work_location"] == "CMU Campus"

    def test_update_profile_interests(self, client):
        resp = client.put(
            "/api/v1/profile",
            json={"interests": ["hiking", "coding"], "projects": ["Anchorpoint"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "hiking" in data["interests"]
        assert "Anchorpoint" in data["projects"]


class TestConversationsRoute:
    def test_list_conversations_returns_list(self, client):
        resp = client.get("/api/v1/conversations")
        assert resp.status_code == 200
        assert isinstance(resp.json()["conversations"], list)

    def test_get_nonexistent_conversation_returns_404(self, client):
        resp = client.get("/api/v1/conversations/does-not-exist")
        assert resp.status_code == 404

    def test_search_conversations_returns_results(self, client):
        resp = client.get("/api/v1/conversations?search=hello")
        assert resp.status_code == 200
        data = resp.json()
        assert "conversations" in data

    def test_clear_all_conversations(self, client):
        client.put(
            "/api/v1/profile",
            json={
                "name": "Alice",
                "home_location": "Pittsburgh, PA",
                "interests": ["hiking"],
                "projects": ["Anchorpoint"],
                "onboarding_done": True,
            },
        )

        resp = client.delete("/api/v1/conversations")
        assert resp.status_code == 200
        data = resp.json()
        assert "deleted" in data
        assert data["profile_reset"] is True

        profile = client.get("/api/v1/profile")
        assert profile.status_code == 200
        assert profile.json()["onboarding_done"] is False
        assert profile.json()["name"] is None


# Models route
class TestModelsRoute:
    def test_list_models_returns_shape(self, client):
        resp = client.get("/api/v1/models")
        assert resp.status_code == 200
        data = resp.json()
        assert "installed" in data
        assert "available" in data

    def test_recommendation_returns_valid_tier(self, client):
        resp = client.get("/api/v1/models/recommendation")
        assert resp.status_code == 200
        assert resp.json()["tier"] in ("light", "standard", "performance")
