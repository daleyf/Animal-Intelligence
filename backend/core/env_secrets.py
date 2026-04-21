from __future__ import annotations

from pathlib import Path

from dotenv import dotenv_values, set_key, unset_key

from core.config import Settings, settings
from core.integrations.calendar_client import calendar_client
from core.integrations.weather import weather_client

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"

ALLOWED_INTEGRATION_ENV_KEYS: dict[str, str] = {
    "OLLAMA_API_KEY": "ollama_api_key",
    "OPENWEATHERMAP_API_KEY": "openweathermap_api_key",
    "GOOGLE_CLIENT_ID": "google_client_id",
    "GOOGLE_CLIENT_SECRET": "google_client_secret",
}


def _validate_key(key: str) -> None:
    if key not in ALLOWED_INTEGRATION_ENV_KEYS:
        raise KeyError(f"Unsupported integration env key: {key}")


def _read_env_values() -> dict[str, str]:
    if not ENV_PATH.exists():
        return {}
    return {
        str(key): str(value)
        for key, value in dotenv_values(ENV_PATH).items()
        if key is not None and value is not None
    }


def _mask_suffix(value: str) -> str | None:
    if len(value) < 4:
        return None
    return value[-4:]


def _refresh_runtime_settings() -> None:
    refreshed = Settings(_env_file=str(ENV_PATH))
    for field_name in Settings.model_fields:
        setattr(settings, field_name, getattr(refreshed, field_name))

    weather_client._api_key = settings.openweathermap_api_key
    calendar_client._client_id = settings.google_client_id
    calendar_client._client_secret = settings.google_client_secret
    calendar_client._redirect_uri = settings.google_redirect_uri


def get_integration_secret_metadata(key: str) -> dict[str, str | bool | None]:
    _validate_key(key)
    value = _read_env_values().get(key, "").strip()
    return {
        "key": key,
        "configured": bool(value),
        "last4": _mask_suffix(value) if value else None,
    }


def list_integration_secret_metadata() -> dict[str, dict[str, str | bool | None]]:
    return {
        key: get_integration_secret_metadata(key)
        for key in ALLOWED_INTEGRATION_ENV_KEYS
    }


def set_integration_secret(key: str, value: str) -> dict[str, str | bool | None]:
    _validate_key(key)
    sanitized = value.strip()
    if not sanitized:
        raise ValueError("Secret value cannot be empty.")

    ENV_PATH.touch(exist_ok=True)
    set_key(str(ENV_PATH), key, sanitized, quote_mode="auto")
    _refresh_runtime_settings()
    return get_integration_secret_metadata(key)


def clear_integration_secret(key: str) -> dict[str, str | bool | None]:
    _validate_key(key)
    if ENV_PATH.exists():
        unset_key(str(ENV_PATH), key, quote_mode="auto")
    _refresh_runtime_settings()
    return get_integration_secret_metadata(key)
