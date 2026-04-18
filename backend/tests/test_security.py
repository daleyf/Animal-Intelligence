"""
Security and feature tests — PII sanitization, encryption, context-window
optimisation, hardware recommendation, and custom voice profiles.

All tests use in-memory SQLite.  No real network calls are made.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from db.models import Base, AppSettings
from db.database import DEFAULT_SETTINGS


# ── Shared fixtures ────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def test_db_engine():
    # StaticPool ensures all sessions share the same connection so tables
    # created by create_all() are visible to every subsequent query.
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
            for token in ["Hello", "!"]:
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


# ── PII Sanitizer ─────────────────────────────────────────────────────────────

class TestPIISanitizer:
    def test_clean_string_unchanged(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize("What is the capital of France?")
        assert result == "What is the capital of France?"
        assert changed is False

    def test_email_redacted(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize("Contact me at john.doe@example.com for info")
        assert "[EMAIL]" in result
        assert "john.doe@example.com" not in result
        assert changed is True

    def test_phone_redacted(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize("Call me at 412-555-1234 anytime")
        assert "[PHONE]" in result
        assert "412-555-1234" not in result
        assert changed is True

    def test_ssn_redacted(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize("My SSN is 123-45-6789")
        assert "[SSN]" in result
        assert "123-45-6789" not in result
        assert changed is True

    def test_profile_name_redacted(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize("John Smith is looking for jobs", name="John Smith")
        assert "[NAME]" in result
        assert "John Smith" not in result
        assert changed is True

    def test_home_location_redacted(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize(
            "restaurants near Pittsburgh PA",
            home_location="Pittsburgh PA",
        )
        assert "[HOME]" in result
        assert "Pittsburgh PA" not in result
        assert changed is True

    def test_work_location_redacted(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize(
            "parking near CMU campus",
            work_location="CMU campus",
        )
        assert "[WORK]" in result
        assert "CMU campus" not in result
        assert changed is True

    def test_multiple_pii_types(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize(
            "Alice (alice@test.com) at 555-123-4567",
            name="Alice",
        )
        assert "[EMAIL]" in result
        assert "[PHONE]" in result
        assert "[NAME]" in result
        assert changed is True

    def test_empty_string(self):
        from core.pii_sanitizer import sanitize
        result, changed = sanitize("")
        assert result == ""
        assert changed is False

    def test_none_profile_fields_ignored(self):
        from core.pii_sanitizer import sanitize
        # Should not raise with None profile fields
        result, _ = sanitize("hello world", name=None, home_location=None)
        assert result == "hello world"


# ── Encryption utilities ──────────────────────────────────────────────────────

class TestEncryption:
    def test_encrypt_decrypt_roundtrip(self):
        from core.encryption import encrypt_field, decrypt_field
        original = "my-secret-token-abc123"
        encrypted = encrypt_field(original)
        assert encrypted != original          # must differ
        decrypted = decrypt_field(encrypted)
        assert decrypted == original

    def test_encrypt_none_returns_none(self):
        from core.encryption import encrypt_field
        assert encrypt_field(None) is None

    def test_decrypt_none_returns_none(self):
        from core.encryption import decrypt_field
        assert decrypt_field(None) is None

    def test_decrypt_legacy_plaintext_returns_as_is(self):
        """decrypt_field must not crash on a non-Fernet plaintext value."""
        from core.encryption import decrypt_field
        raw = "plaintext_that_was_never_encrypted"
        result = decrypt_field(raw)
        assert result == raw  # graceful degradation

    def test_different_values_produce_different_ciphertexts(self):
        from core.encryption import encrypt_field
        a = encrypt_field("token-a")
        b = encrypt_field("token-b")
        assert a != b


# ── Context window optimisation ────────────────────────────────────────────────

class TestContextWindowOptimisation:
    def _msg(self, role, content):
        from unittest.mock import MagicMock
        m = MagicMock()
        m.role = role
        m.content = content
        return m

    def test_stats_dict_returned(self):
        from core.prompt_builder import build_context_messages
        msgs = [self._msg("user", "Hello")]
        _, stats = build_context_messages(msgs, system_prompt="sys", max_tokens=4096)
        required_keys = {
            "max_tokens", "system_tokens", "history_tokens",
            "messages_included", "messages_total", "budget_exhausted",
        }
        assert required_keys.issubset(stats.keys())

    def test_min_recent_messages_always_kept(self):
        """Even under extreme budget pressure the most recent turns survive."""
        from core.prompt_builder import build_context_messages
        msgs = [
            self._msg("user", "old " * 500),
            self._msg("assistant", "old reply " * 500),
            self._msg("user", "recent question"),
            self._msg("assistant", "recent answer"),
        ]
        # Use response_buffer=0 so the tiny max_tokens still leaves room for
        # the history allocation logic (not the emergency early-exit branch).
        result, _ = build_context_messages(
            msgs, system_prompt="", max_tokens=100,
            response_buffer=0, min_recent_messages=2,
        )
        contents = {m["content"] for m in result}
        assert "recent question" in contents
        assert "recent answer" in contents

    def test_memory_budget_ratio_reflected_in_stats(self):
        from core.prompt_builder import build_context_messages
        msgs = [self._msg("user", "hi")]
        _, stats = build_context_messages(
            msgs, system_prompt="", max_tokens=1000,
            response_buffer=0, memory_budget_ratio=0.3,
        )
        assert "memory_budget_reserved" in stats
        assert stats["memory_budget_reserved"] > 0

    def test_budget_exhausted_flag(self):
        from core.prompt_builder import build_context_messages
        # Many long messages in a tiny budget
        msgs = [self._msg("user", "word " * 300) for _ in range(10)]
        _, stats = build_context_messages(msgs, system_prompt="", max_tokens=50)
        assert stats["budget_exhausted"] is True


# ── Hardware recommendation ────────────────────────────────────────────────────

def test_hardware_recommendation_endpoint(client):
    resp = client.get("/api/v1/models/recommendation")
    assert resp.status_code == 200
    data = resp.json()
    assert "recommended_model" in data
    assert "tier" in data
    assert "reason" in data
    assert "ram_gb" in data
    assert "os" in data
    assert data["tier"] in ("light", "standard", "performance")
    assert data["ram_gb"] >= 0


def test_hardware_recommendation_model_is_known(client):
    """Returned model name should be from the curated list."""
    from core.ollama_client import KNOWN_MODELS
    resp = client.get("/api/v1/models/recommendation")
    assert resp.status_code == 200
    model_name = resp.json()["recommended_model"]
    known_names = {m["name"] for m in KNOWN_MODELS}
    assert model_name in known_names


# ── Custom voice profiles ─────────────────────────────────────────────────────

def test_custom_profiles_initially_empty(client):
    resp = client.get("/api/v1/voice/custom-profiles")
    assert resp.status_code == 200
    assert resp.json()["profiles"] == []


def test_create_custom_profile(client):
    resp = client.post(
        "/api/v1/voice/custom-profiles",
        json={"name": "Calm", "rate": 0.8, "pitch": 1.1},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Calm"
    assert data["rate"] == pytest.approx(0.8, abs=0.01)
    assert data["pitch"] == pytest.approx(1.1, abs=0.01)
    assert "id" in data


def test_create_and_list_custom_profiles(client):
    client.post("/api/v1/voice/custom-profiles", json={"name": "Energetic", "rate": 1.5, "pitch": 1.2})
    resp = client.get("/api/v1/voice/custom-profiles")
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()["profiles"]]
    assert "Energetic" in names


def test_custom_profiles_appear_in_all_profiles(client):
    client.post("/api/v1/voice/custom-profiles", json={"name": "Serene", "rate": 0.7, "pitch": 0.9})
    resp = client.get("/api/v1/voice/profiles")
    assert resp.status_code == 200
    profiles = resp.json()["profiles"]
    # Built-ins still present
    ids = {p["id"] for p in profiles}
    assert "neutral" in ids and "warm" in ids and "professional" in ids
    # Custom profile included
    names = [p["name"] for p in profiles]
    assert "Serene" in names


def test_delete_custom_profile(client):
    create_resp = client.post(
        "/api/v1/voice/custom-profiles",
        json={"name": "ToDelete", "rate": 1.0, "pitch": 1.0},
    )
    profile_id = create_resp.json()["id"]

    del_resp = client.delete(f"/api/v1/voice/custom-profiles/{profile_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["deleted"] == profile_id

    # Confirm it's gone
    list_resp = client.get("/api/v1/voice/custom-profiles")
    ids = [p["id"] for p in list_resp.json()["profiles"]]
    assert profile_id not in ids


def test_delete_nonexistent_custom_profile(client):
    resp = client.delete("/api/v1/voice/custom-profiles/nonexistent-id")
    assert resp.status_code == 404


def test_select_custom_profile_updates_settings(client):
    create_resp = client.post(
        "/api/v1/voice/custom-profiles",
        json={"name": "MyVoice", "rate": 1.3, "pitch": 0.85},
    )
    profile_id = create_resp.json()["id"]

    put_resp = client.put("/api/v1/voice/settings", json={"profile": profile_id})
    assert put_resp.status_code == 200
    data = put_resp.json()
    assert data["profile"] == profile_id
    assert data["rate"] == pytest.approx(1.3, abs=0.01)
    assert data["pitch"] == pytest.approx(0.85, abs=0.01)


def test_select_invalid_profile_returns_422(client):
    resp = client.put("/api/v1/voice/settings", json={"profile": "does-not-exist"})
    assert resp.status_code == 422


def test_create_profile_invalid_rate_rejected(client):
    resp = client.post(
        "/api/v1/voice/custom-profiles",
        json={"name": "Bad", "rate": 5.0, "pitch": 1.0},
    )
    assert resp.status_code == 422


def test_create_profile_invalid_pitch_rejected(client):
    resp = client.post(
        "/api/v1/voice/custom-profiles",
        json={"name": "Bad", "rate": 1.0, "pitch": 3.0},
    )
    assert resp.status_code == 422
