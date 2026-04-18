"""
SQLAlchemy ORM models for Anchorpoint.

Tables:
  - Conversation
  - Message
  - UserProfile         (single row, id=1)
  - AppSettings         (key-value store)
  - GoogleCalendarToken (single row, id=1 — OAuth tokens encrypted at rest)
  - ToolLog             (append-only audit log of tool invocations)
  - CustomVoiceProfile  (user-created voice profiles)
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=_new_uuid)
    title = Column(String(255), nullable=True)  # auto-titled by LLM background task
    model_name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)
    is_deleted = Column(Boolean, default=False, nullable=False)

    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at",
        cascade="all, delete-orphan",
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_new_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" | "assistant" | "system"
    content = Column(Text, nullable=False)
    token_count = Column(Integer, nullable=True)  # stored after generation
    created_at = Column(DateTime, default=_utcnow)

    conversation = relationship("Conversation", back_populates="messages")


class UserProfile(Base):
    """
    Single-row table. Application layer always upserts with id=1.
    """

    __tablename__ = "user_profile"

    id = Column(Integer, primary_key=True, default=1)
    name = Column(String(100), nullable=True)
    home_location = Column(String(255), nullable=True)
    work_location = Column(String(255), nullable=True)
    interests = Column(JSON, nullable=True)  # list[str]
    projects = Column(JSON, nullable=True)  # list[str]
    onboarding_done = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class AppSettings(Base):
    """
    Key-value store for application settings.
    New settings can be added without schema migrations.
    """

    __tablename__ = "app_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class ToolLog(Base):
    """
    Append-only audit log of every tool invocation (web search, memory, calendar,
    weather, news, commute). Provides the transparency NFR (NFR-06).
    PII is stripped from input_summary before storage.
    """

    __tablename__ = "tool_logs"

    id = Column(String, primary_key=True, default=_new_uuid)
    tool_name = Column(String(100), nullable=False)   # e.g. "web_search", "weather"
    input_summary = Column(Text, nullable=True)        # sanitized params (≤500 chars)
    success = Column(Boolean, nullable=False)
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=_utcnow, index=True)


class GoogleCalendarToken(Base):
    """
    Single-row table (id=1) storing the user's Google Calendar OAuth tokens.
    Sensitive fields (access_token, refresh_token, client_secret) are encrypted
    at rest via core.encryption — encrypt on write, decrypt on read.
    """

    __tablename__ = "google_calendar_tokens"

    id = Column(Integer, primary_key=True, default=1)
    access_token = Column(Text, nullable=True)    # encrypted
    refresh_token = Column(Text, nullable=True)   # encrypted
    token_uri = Column(String(255), nullable=True)
    client_id = Column(String(255), nullable=True)
    client_secret = Column(String(255), nullable=True)  # encrypted
    scopes = Column(Text, nullable=True)  # space-separated scope strings
    expires_at = Column(DateTime, nullable=True)
    connected = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)


class CustomVoiceProfile(Base):
    """
    User-created voice profiles.
    Stored alongside the three built-in profiles (neutral, warm, professional).
    """

    __tablename__ = "custom_voice_profiles"

    id = Column(String, primary_key=True, default=_new_uuid)
    name = Column(String(100), nullable=False)
    rate = Column(Float, nullable=False, default=1.0)   # 0.5 – 2.0
    pitch = Column(Float, nullable=False, default=1.0)  # 0.0 – 2.0
    created_at = Column(DateTime, default=_utcnow)
