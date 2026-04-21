"""CRUD operations for UserProfile (single-row table, id=1)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from db.models import UserProfile


def get_profile(db: Session) -> UserProfile | None:
    return db.get(UserProfile, 1)


def upsert_profile(db: Session, data: dict) -> UserProfile:
    """Create or update the single user profile row."""
    profile = db.get(UserProfile, 1)
    if profile is None:
        profile = UserProfile(id=1)
        db.add(profile)

    for field, value in data.items():
        if hasattr(profile, field):
            setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


def reset_profile(db: Session) -> UserProfile:
    """Reset the single user profile row back to pre-onboarding defaults."""
    profile = db.get(UserProfile, 1)
    if profile is None:
        profile = UserProfile(id=1)
        db.add(profile)

    profile.name = None
    profile.home_location = None
    profile.work_location = None
    profile.interests = None
    profile.projects = None
    profile.onboarding_done = False

    db.commit()
    db.refresh(profile)
    return profile
