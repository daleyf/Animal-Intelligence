"""App settings routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.dependencies import get_db
from db.crud import settings as settings_crud

router = APIRouter()


@router.get("/settings")
def get_settings(db: Session = Depends(get_db)):
    return settings_crud.get_all(db)


@router.put("/settings")
def update_settings(updates: dict[str, str], db: Session = Depends(get_db)):
    settings_crud.update_many(db, updates)
    return settings_crud.get_all(db)
