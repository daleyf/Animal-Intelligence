"""Model management routes."""

import json
import platform
from typing import AsyncIterator

from fastapi import APIRouter, Body, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.dependencies import get_db, get_ollama
from core.ollama_client import OllamaClient, KNOWN_MODELS
from db.crud import settings as settings_crud

router = APIRouter()


class ModelInfo(BaseModel):
    name: str
    description: str
    size_gb: float
    min_ram_gb: int
    is_installed: bool
    is_active: bool


class ModelsResponse(BaseModel):
    installed: list[ModelInfo]
    available: list[ModelInfo]
    active_model: str


@router.get("/models", response_model=ModelsResponse)
async def list_models(
    db: Session = Depends(get_db),
    ollama: OllamaClient = Depends(get_ollama),
):
    installed_raw = await ollama.list_installed_models()
    active_model = settings_crud.get_value(db, "active_model", "")

    installed_names = {m["name"] for m in installed_raw}

    # Auto-correct active_model if the stored value is not installed
    if installed_names and active_model not in installed_names:
        active_model = next(iter(installed_names))
        settings_crud.set_value(db, "active_model", active_model)

    installed: list[ModelInfo] = []
    for m in installed_raw:
        name = m["name"]
        # Find metadata from known models list, fall back to defaults
        meta = next((k for k in KNOWN_MODELS if k["name"] == name), None)
        installed.append(
            ModelInfo(
                name=name,
                description=meta["description"] if meta else name,
                size_gb=meta["size_gb"] if meta else round(m.get("size", 0) / 1e9, 1),
                min_ram_gb=meta["min_ram_gb"] if meta else 8,
                is_installed=True,
                is_active=(name == active_model),
            )
        )

    available: list[ModelInfo] = []
    for meta in KNOWN_MODELS:
        if meta["name"] not in installed_names:
            available.append(
                ModelInfo(
                    name=meta["name"],
                    description=meta["description"],
                    size_gb=meta["size_gb"],
                    min_ram_gb=meta["min_ram_gb"],
                    is_installed=False,
                    is_active=False,
                )
            )

    return ModelsResponse(
        installed=installed,
        available=available,
        active_model=active_model or "",
    )


@router.post("/models/pull")
async def pull_model(
    name: str = Body(..., embed=True),
    ollama: OllamaClient = Depends(get_ollama),
) -> StreamingResponse:
    """Stream model download progress as SSE events."""

    async def event_stream() -> AsyncIterator[str]:
        try:
            async for chunk in ollama.pull_model(name):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield f"data: {json.dumps({'status': 'done', 'completed': None, 'total': None})}\n\n"
        except ConnectionError as exc:
            yield f"data: {json.dumps({'status': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.put("/models/active")
def set_active_model(
    model: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    settings_crud.set_value(db, "active_model", model)
    return {"active_model": model}


# ── Hardware-based model recommendation ───────────────────────────────────────

# Tier thresholds (total RAM in GB)
_TIERS = [
    # (min_ram_gb, model_name, tier_label, reason_template)
    (
        32,
        "gemma2:27b",
        "performance",
        "Your system has {ram:.0f} GB RAM — gemma2:27b (~16 GB) delivers "
        "high-quality responses and will run comfortably.",
    ),
    (
        12,
        "llama3.1:8b",
        "standard",
        "Your system has {ram:.0f} GB RAM — llama3.1:8b (~4.7 GB) is the "
        "recommended choice: excellent quality with headroom to spare.",
    ),
    (
        6,
        "mistral:7b",
        "standard",
        "Your system has {ram:.0f} GB RAM — mistral:7b (~4.1 GB) offers "
        "strong performance within your available memory.",
    ),
    (
        0,
        "phi3:mini",
        "light",
        "Your system has {ram:.0f} GB RAM — phi3:mini (~2.3 GB) is optimised "
        "for limited resources while still being capable.",
    ),
]


def _get_ram_gb() -> float:
    try:
        import psutil
        return psutil.virtual_memory().total / (1024 ** 3)
    except Exception:
        return 0.0


@router.get("/models/recommendation")
def model_recommendation():
    """
    Return a hardware-based model recommendation.

    Reads total system RAM via psutil and maps it to the most capable model
    expected to fit comfortably in memory.
    """
    ram_gb = _get_ram_gb()
    os_name = platform.system()  # 'Linux', 'Darwin', 'Windows'

    recommended_model = "phi3:mini"
    tier = "light"
    reason = f"Your system has {ram_gb:.0f} GB RAM — phi3:mini is the safest choice."

    for min_ram, model_name, tier_label, reason_tpl in _TIERS:
        if ram_gb >= min_ram:
            recommended_model = model_name
            tier = tier_label
            reason = reason_tpl.format(ram=ram_gb)
            break

    # Find metadata for the recommended model
    meta = next((m for m in KNOWN_MODELS if m["name"] == recommended_model), None)

    return {
        "recommended_model": recommended_model,
        "tier": tier,
        "reason": reason,
        "ram_gb": round(ram_gb, 1),
        "os": os_name,
        "size_gb": meta["size_gb"] if meta else None,
        "min_ram_gb": meta["min_ram_gb"] if meta else None,
    }
