from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Core
    ollama_base_url: str = "http://localhost:11434"
    database_url: str = "sqlite:///./anchorpoint.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    default_model: str = "llama3.1:8b"
    context_window_tokens: int = 4096
    debug: bool = False

    # Vector memory
    chroma_db_path: str = "./chroma_db"

    # External API keys (empty = feature disabled)
    ollama_api_key: str = ""  # Ollama account API key — ollama.com/settings/keys
    openweathermap_api_key: str = ""
    news_api_key: str = ""
    google_maps_api_key: str = ""

    # Google Calendar OAuth
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:5173/settings/integrations"

    # Encryption at rest
    # Fernet key (base64url, 44 chars). If unset, a key is auto-generated at
    # backend/.secret_key on first run.  Never commit .secret_key to git.
    encryption_key: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
