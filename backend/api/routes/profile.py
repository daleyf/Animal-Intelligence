"""User profile routes."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import get_db
from db.crud import profile as profile_crud

router = APIRouter()


class ProfileOut(BaseModel):
    name: str | None
    home_location: str | None
    work_location: str | None
    interests: list[str] | None
    projects: list[str] | None
    onboarding_done: bool


class ProfileUpdate(BaseModel):
    name: str | None = None
    home_location: str | None = None
    work_location: str | None = None
    interests: list[str] | None = None
    projects: list[str] | None = None
    onboarding_done: bool | None = None


@router.get("/profile", response_model=ProfileOut)
def get_profile(db: Session = Depends(get_db)):
    profile = profile_crud.get_profile(db)
    if profile is None:
        # Return defaults — profile row doesn't exist yet
        return ProfileOut(
            name=None,
            home_location=None,
            work_location=None,
            interests=None,
            projects=None,
            onboarding_done=False,
        )
    return ProfileOut(
        name=profile.name,
        home_location=profile.home_location,
        work_location=profile.work_location,
        interests=profile.interests or [],
        projects=profile.projects or [],
        onboarding_done=profile.onboarding_done,
    )


@router.put("/profile", response_model=ProfileOut)
def update_profile(data: ProfileUpdate, db: Session = Depends(get_db)):
    # Only include fields explicitly provided (not None means provided)
    updates = {k: v for k, v in data.model_dump().items() if v is not None}
    profile = profile_crud.upsert_profile(db, updates)
    return ProfileOut(
        name=profile.name,
        home_location=profile.home_location,
        work_location=profile.work_location,
        interests=profile.interests or [],
        projects=profile.projects or [],
        onboarding_done=profile.onboarding_done,
    )
