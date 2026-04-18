"""
Voice settings routes.

TTS synthesis runs entirely in the browser via the Web Speech API (local, OS
voices, no network required).  The backend manages voice profile definitions
and the user's saved settings.

  GET  /voice/profiles                → built-in + custom voice profiles
  GET  /voice/settings                → current voice settings
  PUT  /voice/settings                → update voice settings
  GET  /voice/custom-profiles         → user-created profiles
  POST /voice/custom-profiles         → create a custom profile
  DELETE /voice/custom-profiles/{id}  → delete a custom profile
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from api.dependencies import get_db
from db.crud import settings as settings_crud
from db.models import CustomVoiceProfile

router = APIRouter()


# ---------------------------------------------------------------------------
# Built-in profiles (consumed by the browser's SpeechSynthesisUtterance)
# ---------------------------------------------------------------------------

VOICE_PROFILES = [
    {
        "id": "neutral",
        "name": "Neutral",
        "description": "Balanced pace and tone — good for general use",
        "rate": 1.0,
        "pitch": 1.0,
        "is_custom": False,
    },
    {
        "id": "warm",
        "name": "Warm",
        "description": "Slightly slower and higher-pitched — conversational feel",
        "rate": 0.9,
        "pitch": 1.15,
        "is_custom": False,
    },
    {
        "id": "professional",
        "name": "Professional",
        "description": "Crisp and efficient — ideal for reports",
        "rate": 1.1,
        "pitch": 0.95,
        "is_custom": False,
    },
]

_BUILTIN_IDS = {p["id"] for p in VOICE_PROFILES}


def _profile_rate_pitch(profile_id: str, db: Session) -> tuple[float, float] | None:
    """Return (rate, pitch) for a profile ID, checking built-ins then custom."""
    builtin = next((p for p in VOICE_PROFILES if p["id"] == profile_id), None)
    if builtin:
        return builtin["rate"], builtin["pitch"]
    custom = db.get(CustomVoiceProfile, profile_id)
    if custom:
        return custom.rate, custom.pitch
    return None


# ---------------------------------------------------------------------------
# Built-in profile routes
# ---------------------------------------------------------------------------

@router.get("/voice/profiles")
def get_profiles(db: Session = Depends(get_db)):
    """Return built-in + user-created voice profiles."""
    custom_rows = db.query(CustomVoiceProfile).order_by(CustomVoiceProfile.created_at).all()
    custom = [
        {
            "id": row.id,
            "name": row.name,
            "description": f"Custom — {row.rate:.2f}× speed, {row.pitch:.2f} pitch",
            "rate": row.rate,
            "pitch": row.pitch,
            "is_custom": True,
        }
        for row in custom_rows
    ]
    return {"profiles": VOICE_PROFILES + custom}


@router.get("/voice/settings")
def get_voice_settings(db: Session = Depends(get_db)):
    """Return the user's current voice configuration."""
    s = settings_crud.get_all(db)
    return {
        "enabled": s.get("voice_enabled", "false") == "true",
        "profile": s.get("voice_profile", "neutral"),
        "rate": float(s.get("voice_rate", "1.0")),
        "pitch": float(s.get("voice_pitch", "1.0")),
    }


class VoiceSettingsUpdate(BaseModel):
    enabled: bool | None = None
    # Profile can be a built-in id or a UUID (custom profile)
    profile: str | None = Field(None, min_length=1, max_length=100)
    rate: float | None = Field(None, ge=0.5, le=2.0)
    pitch: float | None = Field(None, ge=0.0, le=2.0)


@router.put("/voice/settings")
def update_voice_settings(
    body: VoiceSettingsUpdate,
    db: Session = Depends(get_db),
):
    """Update voice settings.  Only provided fields are changed."""
    updates: dict[str, str] = {}

    if body.enabled is not None:
        updates["voice_enabled"] = "true" if body.enabled else "false"

    if body.profile is not None:
        rp = _profile_rate_pitch(body.profile, db)
        if rp is None:
            raise HTTPException(status_code=422, detail=f"Unknown voice profile: {body.profile!r}")
        updates["voice_profile"] = body.profile
        updates["voice_rate"] = str(rp[0])
        updates["voice_pitch"] = str(rp[1])

    if body.rate is not None:
        updates["voice_rate"] = str(body.rate)
    if body.pitch is not None:
        updates["voice_pitch"] = str(body.pitch)

    if updates:
        settings_crud.update_many(db, updates)

    return get_voice_settings(db)


# ---------------------------------------------------------------------------
# Custom profile CRUD
# ---------------------------------------------------------------------------

class CustomProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    rate: float = Field(1.0, ge=0.5, le=2.0)
    pitch: float = Field(1.0, ge=0.0, le=2.0)


@router.get("/voice/custom-profiles")
def list_custom_profiles(db: Session = Depends(get_db)):
    """Return all user-created voice profiles."""
    rows = db.query(CustomVoiceProfile).order_by(CustomVoiceProfile.created_at).all()
    return {
        "profiles": [
            {
                "id": r.id,
                "name": r.name,
                "rate": r.rate,
                "pitch": r.pitch,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }


@router.post("/voice/custom-profiles", status_code=201)
def create_custom_profile(
    body: CustomProfileCreate,
    db: Session = Depends(get_db),
):
    """Create a new custom voice profile."""
    profile = CustomVoiceProfile(
        id=str(uuid.uuid4()),
        name=body.name,
        rate=body.rate,
        pitch=body.pitch,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return {
        "id": profile.id,
        "name": profile.name,
        "rate": profile.rate,
        "pitch": profile.pitch,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
    }


@router.delete("/voice/custom-profiles/{profile_id}")
def delete_custom_profile(
    profile_id: str,
    db: Session = Depends(get_db),
):
    """Delete a custom voice profile by ID."""
    profile = db.get(CustomVoiceProfile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Custom profile not found")

    # If this profile is currently active, reset to neutral
    current = settings_crud.get_value(db, "voice_profile", "neutral")
    if current == profile_id:
        settings_crud.update_many(db, {
            "voice_profile": "neutral",
            "voice_rate": "1.0",
            "voice_pitch": "1.0",
        })

    db.delete(profile)
    db.commit()
    return {"deleted": profile_id}
