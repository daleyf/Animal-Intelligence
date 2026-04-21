"""App settings routes."""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.dependencies import get_db
from core.env_secrets import (
    clear_integration_secret,
    list_integration_secret_metadata,
    set_integration_secret,
)
from db.crud import settings as settings_crud

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
