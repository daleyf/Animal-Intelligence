"""Conversation history routes."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import get_db
from db.crud import conversations as conv_crud

router = APIRouter()


class ConversationSummary(BaseModel):
    id: str
    title: str | None
    model_name: str
    updated_at: str
    preview: str


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]
    total: int


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class ConversationDetailResponse(BaseModel):
    id: str
    title: str | None
    model_name: str
    created_at: str
    messages: list[MessageOut]


@router.get("/conversations", response_model=ConversationListResponse)
def list_conversations(
    search: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    convos, total = conv_crud.list_conversations(db, search=search, limit=limit, offset=offset)
    summaries = []
    for c in convos:
        preview = conv_crud.get_last_message_preview(db, c.id)
        summaries.append(
            ConversationSummary(
                id=c.id,
                title=c.title,
                model_name=c.model_name,
                updated_at=c.updated_at.isoformat() if c.updated_at else "",
                preview=preview,
            )
        )
    return ConversationListResponse(conversations=summaries, total=total)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    convo = conv_crud.get_conversation(db, conversation_id)
    if convo is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = conv_crud.get_messages(db, conversation_id)
    return ConversationDetailResponse(
        id=convo.id,
        title=convo.title,
        model_name=convo.model_name,
        created_at=convo.created_at.isoformat() if convo.created_at else "",
        messages=[
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                created_at=m.created_at.isoformat() if m.created_at else "",
            )
            for m in messages
        ],
    )


class ConversationRename(BaseModel):
    title: str


@router.patch("/conversations/{conversation_id}")
def rename_conversation(
    conversation_id: str,
    body: ConversationRename,
    db: Session = Depends(get_db),
):
    convo = conv_crud.get_conversation(db, conversation_id)
    if convo is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    title = body.title.strip()[:255]
    conv_crud.update_title(db, conversation_id, title)
    return {"ok": True, "title": title}


@router.delete("/conversations")
def clear_all_conversations(db: Session = Depends(get_db)):
    count = conv_crud.hard_delete_all_conversations(db)
    return {"deleted": count}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    success = conv_crud.soft_delete_conversation(db, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}
