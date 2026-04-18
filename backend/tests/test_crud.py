"""Unit tests for CRUD operations using an in-memory SQLite database."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from db.models import Base
from db.crud import conversations as conv_crud
from db.crud import profile as profile_crud
from db.crud import settings as settings_crud


@pytest.fixture
def db() -> Session:
    """Create a fresh in-memory SQLite database for each test."""
    engine = create_engine(
        "sqlite:///:memory:", connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    yield session
    session.close()
    engine.dispose()


# ── Conversation CRUD ─────────────────────────────────────────────────────────

class TestConversationCrud:
    def test_create_conversation(self, db):
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        assert convo.id is not None
        assert convo.model_name == "llama3.1:8b"
        assert convo.is_deleted is False
        assert convo.title is None

    def test_get_conversation(self, db):
        convo = conv_crud.create_conversation(db, model_name="mistral:7b")
        fetched = conv_crud.get_conversation(db, convo.id)
        assert fetched is not None
        assert fetched.id == convo.id

    def test_get_nonexistent_conversation(self, db):
        result = conv_crud.get_conversation(db, "does-not-exist")
        assert result is None

    def test_soft_delete_conversation(self, db):
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        result = conv_crud.soft_delete_conversation(db, convo.id)
        assert result is True
        # Should not be findable after soft delete
        assert conv_crud.get_conversation(db, convo.id) is None

    def test_soft_delete_nonexistent(self, db):
        result = conv_crud.soft_delete_conversation(db, "ghost-id")
        assert result is False

    def test_list_conversations_empty(self, db):
        convos, total = conv_crud.list_conversations(db)
        assert convos == []
        assert total == 0

    def test_list_conversations(self, db):
        conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.create_conversation(db, model_name="mistral:7b")
        convos, total = conv_crud.list_conversations(db)
        assert total == 2
        assert len(convos) == 2

    def test_list_conversations_excludes_deleted(self, db):
        c1 = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.create_conversation(db, model_name="mistral:7b")
        conv_crud.soft_delete_conversation(db, c1.id)
        _, total = conv_crud.list_conversations(db)
        assert total == 1

    def test_update_title(self, db):
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.update_title(db, convo.id, "My Chat Title")
        updated = conv_crud.get_conversation(db, convo.id)
        assert updated.title == "My Chat Title"

    def test_add_and_get_messages(self, db):
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.add_message(db, convo.id, "user", "Hello!")
        conv_crud.add_message(db, convo.id, "assistant", "Hi there!", token_count=3)
        messages = conv_crud.get_messages(db, convo.id)
        assert len(messages) == 2
        assert messages[0].role == "user"
        assert messages[1].role == "assistant"
        assert messages[1].token_count == 3

    def test_search_by_title(self, db):
        c = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.update_title(db, c.id, "Python programming help")
        convos, total = conv_crud.list_conversations(db, search="python")
        assert total == 1

    def test_hard_delete_all(self, db):
        conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.create_conversation(db, model_name="mistral:7b")
        count = conv_crud.hard_delete_all_conversations(db)
        assert count == 2
        _, total = conv_crud.list_conversations(db)
        assert total == 0


# ── Profile CRUD ──────────────────────────────────────────────────────────────

class TestProfileCrud:
    def test_get_profile_when_empty(self, db):
        profile = profile_crud.get_profile(db)
        assert profile is None

    def test_upsert_creates_profile(self, db):
        profile = profile_crud.upsert_profile(
            db, {"name": "Alice", "home_location": "Pittsburgh", "onboarding_done": True}
        )
        assert profile.name == "Alice"
        assert profile.home_location == "Pittsburgh"
        assert profile.onboarding_done is True

    def test_upsert_updates_profile(self, db):
        profile_crud.upsert_profile(db, {"name": "Alice"})
        profile_crud.upsert_profile(db, {"name": "Bob"})
        profile = profile_crud.get_profile(db)
        assert profile.name == "Bob"

    def test_profile_id_is_always_1(self, db):
        profile = profile_crud.upsert_profile(db, {"name": "Alice"})
        assert profile.id == 1


# ── Settings CRUD ─────────────────────────────────────────────────────────────

class TestSettingsCrud:
    def test_set_and_get(self, db):
        settings_crud.set_value(db, "active_model", "mistral:7b")
        value = settings_crud.get_value(db, "active_model")
        assert value == "mistral:7b"

    def test_get_default(self, db):
        value = settings_crud.get_value(db, "nonexistent_key", default="fallback")
        assert value == "fallback"

    def test_get_all(self, db):
        settings_crud.set_value(db, "key1", "val1")
        settings_crud.set_value(db, "key2", "val2")
        all_settings = settings_crud.get_all(db)
        assert all_settings["key1"] == "val1"
        assert all_settings["key2"] == "val2"

    def test_update_many(self, db):
        settings_crud.update_many(db, {"a": "1", "b": "2"})
        assert settings_crud.get_value(db, "a") == "1"
        assert settings_crud.get_value(db, "b") == "2"
