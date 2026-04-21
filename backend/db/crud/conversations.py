"""CRUD operations for Conversation and Message models."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from db.models import Conversation, Message


def create_conversation(
    db: Session, model_name: str, conversation_type: str = "chat"
) -> Conversation:
    convo = Conversation(model_name=model_name, conversation_type=conversation_type)
    db.add(convo)
    db.commit()
    db.refresh(convo)
    return convo


def get_conversation(db: Session, conversation_id: str) -> Conversation | None:
    return (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.is_deleted.is_(False))
        .first()
    )


def list_conversations(
    db: Session,
    search: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[list[Conversation], int]:
    """Return (conversations, total_count) filtered by search query."""
    q = db.query(Conversation).filter(Conversation.is_deleted.is_(False))

    if search:
        pattern = f"%{search}%"
        # Search in conversation title or message content
        msg_conv_ids = (
            db.query(Message.conversation_id)
            .filter(Message.content.ilike(pattern))
            .scalar_subquery()
        )
        q = q.filter(
            Conversation.title.ilike(pattern) | Conversation.id.in_(msg_conv_ids)
        )

    total = q.count()
    convos = (
        q.order_by(Conversation.updated_at.desc()).offset(offset).limit(limit).all()
    )
    return convos, total


def soft_delete_conversation(db: Session, conversation_id: str) -> bool:
    convo = get_conversation(db, conversation_id)
    if convo is None:
        return False
    convo.is_deleted = True
    db.commit()
    return True


def hard_delete_all_conversations(db: Session) -> int:
    """Delete all conversations and messages. Returns number of conversations deleted."""
    count = db.query(Conversation).count()
    db.query(Message).delete()
    db.query(Conversation).delete()
    db.commit()
    return count


def update_title(db: Session, conversation_id: str, title: str) -> None:
    convo = db.get(Conversation, conversation_id)
    if convo:
        convo.title = title[:255]
        convo.updated_at = datetime.now(timezone.utc)
        db.commit()


def add_message(
    db: Session,
    conversation_id: str,
    role: str,
    content: str,
    token_count: int | None = None,
    extra_data: dict | None = None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role=role,
        content=content,
        token_count=token_count,
        extra_data=extra_data,
    )
    db.add(msg)
    # Bump conversation updated_at so sidebar sorts correctly
    convo = db.get(Conversation, conversation_id)
    if convo:
        convo.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)
    return msg


def get_messages(db: Session, conversation_id: str) -> list[Message]:
    return (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .all()
    )


def get_last_message_preview(db: Session, conversation_id: str) -> str:
    """Return truncated preview of the last assistant message."""
    msg = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id, Message.role == "assistant")
        .order_by(Message.created_at.desc())
        .first()
    )
    if msg is None:
        return ""
    return msg.content[:100]
