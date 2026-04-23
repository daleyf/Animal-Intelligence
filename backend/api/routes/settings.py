"""App settings routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete
from sqlalchemy.orm import Session

from api.dependencies import get_db
from core.memory_store import memory_store
from core.env_secrets import (
    clear_integration_secret,
    list_integration_secret_metadata,
    set_integration_secret,
)
from db.crud import settings as settings_crud
from db.crud import conversations as conv_crud
from db.models import ToolLog, UserProfile

router = APIRouter()


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return settings_crud.get_all(db)


@router.put("/settings")
def update_settings(updates: dict[str, str], db: Session = Depends(get_db)):
    settings_crud.update_many(db, updates)
    return settings_crud.get_all(db)


class IntegrationSecretUpdate(BaseModel):
    value: str = Field(min_length=1)


@router.get("/settings/integrations/secrets")
def get_integration_secrets():
    return list_integration_secret_metadata()


@router.put("/settings/integrations/secrets/{secret_key}")
def update_integration_secret(secret_key: str, body: IntegrationSecretUpdate):
    try:
        return set_integration_secret(secret_key, body.value)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="Unsupported integration key.") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/settings/integrations/secrets/{secret_key}")
def delete_integration_secret(secret_key: str):
    try:
        return clear_integration_secret(secret_key)
    except KeyError as exc:
        raise HTTPException(status_code=400, detail="Unsupported integration key.") from exc


@router.post("/reset")
def factory_reset(db: Session = Depends(get_db)):
    """
    Full factory reset:
      - Hard-delete all conversations and messages
      - Clear the activity log
      - Reset the user profile (onboarding_done=False, all personal fields nulled)
      - Clear vector memory (Chroma) when the memory store is available
    """
    conv_crud.hard_delete_all_conversations(db)
    memory_store.clear_all()
    db.execute(delete(ToolLog))

    profile = db.get(UserProfile, 1)
    if profile is not None:
        profile.name = None
        profile.home_location = None
        profile.work_location = None
        profile.interests = None
        profile.projects = None
        profile.onboarding_done = False

    # Clear cached report content so the Daily Report page shows empty state
    settings_crud.update_many(db, {
        "last_report_content": "",
        "last_report_generated_at": "",
    })

    db.commit()
    return {"reset": True}
