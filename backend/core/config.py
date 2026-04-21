import json

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEFAULT_CORS = "http://localhost:5173"


def _parse_cors_origins(raw: str) -> list[str]:
    """Env CORS_ORIGINS: comma-separated URLs, or a JSON array. Empty uses default."""
    s = (raw or "").strip()
    if not s:
        return [_DEFAULT_CORS]
    if s.startswith("["):
        try:
            parsed = json.loads(s)
        except json.JSONDecodeError as e:
            raise ValueError(f"CORS_ORIGINS must be valid JSON array: {e}") from e
        if not isinstance(parsed, list):
            raise ValueError("CORS_ORIGINS JSON must be an array")
        out = [str(x).strip() for x in parsed if str(x).strip()]
        return out or [_DEFAULT_CORS]
    parts = [x.strip() for x in s.split(",") if x.strip()]
    return parts or [_DEFAULT_CORS]


class Settings(BaseSettings):
    # Core
    ollama_base_url: str = "http://localhost:11434"
    database_url: str = "sqlite:///./anchorpoint.db"
    # Plain str so .env is not forced through json.loads; see _parse_cors_origins.
    cors_origins: str = _DEFAULT_CORS
    default_model: str = "llama3.1:8b"
    context_window_tokens: int = 4096
    debug: bool = False

    # Vector memory
    chroma_db_path: str = "./chroma_db"

    # External API keys (empty = feature disabled)
    ollama_api_key: str = ""  # Ollama account API key — ollama.com/settings/keys
    openweathermap_api_key: str = ""

    # Google Calendar OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/settings/integrations"

    # Encryption at rest
    # Fernet key (base64url, 44 chars). If unset, a key is auto-generated at
    # backend/.secret_key on first run.  Never commit .secret_key to git.
    encryption_key: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
    )

    @computed_field
    @property
    def cors_origins_list(self) -> list[str]:
        return _parse_cors_origins(self.cors_origins)


settings = Settings()
