"""
tests for CRUD operations

These tests use an in-memory SQLite DB and a mock Ollama client so no real
Ollama process is required.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db.models import Base
from db.crud import conversations as conv_crud
from db.crud import profile as profile_crud
from db.crud import settings as settings_crud


# Shared fixtures
# -------------- #
@pytest.fixture
def db():
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


# Conversation CRUD
# -------------- #
class TestConversationCrud:
    # test creating a conversation and verifying its fields
    def test_create_conversation(self, db):
        """Test that creating a conversation returns an object with the expected fields."""
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        assert convo.id is not None
        assert convo.model_name == "llama3.1:8b"
        assert convo.is_deleted is False
        assert convo.title is None

    # test getting a conversation by ID returns the correct conversation
    def test_get_conversation(self, db):
        """Test that getting a conversation by ID returns the correct conversation."""
        convo = conv_crud.create_conversation(db, model_name="mistral:7b")
        fetched = conv_crud.get_conversation(db, convo.id)
        assert fetched is not None
        assert fetched.id == convo.id

    # test getting a nonexistent conversation returns None
    def test_get_nonexistent_conversation(self, db):
        """Test that getting a conversation that doesn't exist returns None."""
        result = conv_crud.get_conversation(db, "does-not-exist")
        assert result is None

    # test soft deleting a conversation marks it as deleted and makes it unfindable
    def test_soft_delete_conversation(self, db):
        """Test that soft deleting a conversation marks it as deleted and makes it unfindable."""
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        result = conv_crud.soft_delete_conversation(db, convo.id)
        assert result is True
        # Should not be found after soft delete
        assert conv_crud.get_conversation(db, convo.id) is None

    # test soft deleting a nonexistent conversation returns False
    def test_soft_delete_nonexistent(self, db):
        """Test that soft deleting a conversation that doesn't exist returns False."""
        result = conv_crud.soft_delete_conversation(db, "ghost-id")
        assert result is False

    # test listing conversations with no conversations returns empty list and total 0
    def test_list_conversations_empty(self, db):
        """Test that listing conversations when there are none returns an empty list and total of 0."""
        convos, total = conv_crud.list_conversations(db)
        assert convos == []
        assert total == 0

    # test listing conversations returns all non-deleted conversations
    def test_list_conversations(self, db):
        """Test that listing conversations returns all non-deleted conversations."""
        conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.create_conversation(db, model_name="mistral:7b")
        convos, total = conv_crud.list_conversations(db)
        assert total == 2
        assert len(convos) == 2

    # test listing conversations excludes soft deleted ones
    def test_list_conversations_excludes_deleted(self, db):
        """Test that listing conversations excludes those that have been soft deleted."""
        c1 = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.create_conversation(db, model_name="mistral:7b")
        conv_crud.soft_delete_conversation(db, c1.id)
        _, total = conv_crud.list_conversations(db)
        assert total == 1

    # test updating the title of a conversation
    def test_update_title(self, db):
        """Test that updating the title of a conversation changes its title field."""
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.update_title(db, convo.id, "My Chat Title")
        updated = conv_crud.get_conversation(db, convo.id)
        assert updated.title == "My Chat Title"

    # test adding messages to a conversation and retrieving them
    def test_add_and_get_messages(self, db):
        """Test that adding messages to a conversation and then retrieving them works as expected."""
        convo = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.add_message(db, convo.id, "user", "Hello!")
        conv_crud.add_message(db, convo.id, "assistant", "Hi there!", token_count=3)
        messages = conv_crud.get_messages(db, convo.id)
        assert len(messages) == 2
        assert messages[0].role == "user"
        assert messages[1].role == "assistant"
        assert messages[1].token_count == 3

    # test searching conversations by title
    def test_search_by_title(self, db):
        """Test that searching conversations by title returns the correct conversations."""
        c = conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.update_title(db, c.id, "Python programming help")
        convos, total = conv_crud.list_conversations(db, search="python")
        assert total == 1

    # test hard deleting all conversations removes them from the database
    def test_hard_delete_all(self, db):
        """Test that hard deleting all conversations removes them from the database."""
        conv_crud.create_conversation(db, model_name="llama3.1:8b")
        conv_crud.create_conversation(db, model_name="mistral:7b")
        count = conv_crud.hard_delete_all_conversations(db)
        assert count == 2
        # After hard delete, listing conversations should return empty list and total 0
        convos, total = conv_crud.list_conversations(db)
        assert len(convos) == 0
        assert total == 0


# Profile CRUD
# -------------- #
class TestProfileCrud:
    # test getting profile when none exists returns None
    def test_get_profile_when_empty(self, db):
        """Test that getting the profile when none exists returns None."""
        profile = profile_crud.get_profile(db)
        assert profile is None

    # test creating a profile with upsert and getting it back
    def test_upsert_creates_profile(self, db):
        """Test that upserting a profile creates it if it doesn't exist."""
        profile = profile_crud.upsert_profile(
            db, {"name": "Alice", "home_location": "Pittsburgh", "onboarding_done": True}
        )
        assert profile.name == "Alice"
        assert profile.home_location == "Pittsburgh"
        assert profile.onboarding_done is True

    # test updating the profile with upsert
    def test_upsert_updates_profile(self, db):
        """Test that upserting a profile updates the existing one."""
        profile_crud.upsert_profile(db, {"name": "Alice"})
        profile_crud.upsert_profile(db, {"name": "Bob"})
        profile = profile_crud.get_profile(db)
        assert profile.name == "Bob"

    #  after upserting multiple times, the profile ID should still be 1 (only one profile record).
    def test_profile_id_is_always_1(self, db):
        """Test that the profile ID is always 1, even after multiple upserts."""
        profile = profile_crud.upsert_profile(db, {"name": "Alice"})
        assert profile.id == 1


# Settings CRUD
# -------------- #
class TestSettingsCrud:
    # test setting and getting a setting value
    def test_set_and_get(self, db):
        """Test setting and getting a settings value."""
        settings_crud.set_value(db, "active_model", "mistral:7b")
        value = settings_crud.get_value(db, "active_model")
        assert value == "mistral:7b"

    # test getting a nonexistent key with a default value
    def test_get_default(self, db):
        """Test getting a nonexistent key returns the default value."""
        value = settings_crud.get_value(db, "nonexistent_key", default="fallback")
        assert value == "fallback"

    # test getting all settings
    def test_get_all(self, db):
        """Test getting all settings returns a dict of key-value pairs."""
        settings_crud.set_value(db, "key1", "val1")
        settings_crud.set_value(db, "key2", "val2")
        all_settings = settings_crud.get_all(db)
        assert all_settings["key1"] == "val1"
        assert all_settings["key2"] == "val2"

    # test updating an existing key's value
    def test_update_value(self, db):
        """Test updating an existing key's value overwrites the old value."""
        settings_crud.set_value(db, "active_model", "mistral:7b")
        settings_crud.set_value(db, "active_model", "llama3.1:8b")
        value = settings_crud.get_value(db, "active_model")
        assert value == "llama3.1:8b"

    # test updating multiple settings at once
    def test_update_many(self, db):
        """Test updating multiple settings at once."""
        settings_crud.update_many(db, {"a": "1", "b": "2"})
        assert settings_crud.get_value(db, "a") == "1"
        assert settings_crud.get_value(db, "b") == "2"
