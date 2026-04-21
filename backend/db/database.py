import uuid
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from core.config import settings
from db.models import Base, AppSettings

# check_same_thread=False is required because FastAPI is async and SQLite
# defaults to blocking access from threads other than the creating thread.
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},
    echo=settings.debug,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Default settings seeded on first run.
# Keys are inserted only if absent — existing values are never overwritten.
DEFAULT_SETTINGS = {
    "active_model": settings.default_model,
    "personalization_enabled": "true",
    "context_window_tokens": str(settings.context_window_tokens),
    "memory_enabled": "true",
    "web_search_enabled": "false",
    "news_categories": "technology,science,general",
    "morning_report_time": "07:00",
    "voice_enabled": "false",
    "voice_rate": "1.0",          # speech rate multiplier (0.5 – 2.0)
    "voice_pitch": "1.0",         # pitch multiplier (0.0 – 2.0)
    "voice_profile": "neutral",   # neutral | warm | professional
    "report_schedule_enabled": "false",
    "last_report_content": "",
    "last_report_generated_at": "",
}


def init_db() -> None:
    """Create all tables and seed default settings if they don't exist."""
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        for key, value in DEFAULT_SETTINGS.items():
            existing = db.get(AppSettings, key)
            if existing is None:
                db.add(AppSettings(key=key, value=value))
        db.commit()

        # Add new columns to existing databases (SQLite supports ADD COLUMN for nullable columns)
        for migration_sql in [
            "ALTER TABLE conversations ADD COLUMN conversation_type TEXT DEFAULT 'chat'",
            "ALTER TABLE messages ADD COLUMN extra_data TEXT",
        ]:
            try:
                db.execute(text(migration_sql))
                db.commit()
            except Exception:
                db.rollback()  # Column already exists — safe to ignore
    finally:
        db.close()


def get_db():
    """FastAPI dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
