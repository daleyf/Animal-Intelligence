"""CRUD operations for AppSettings key-value store."""

from sqlalchemy.orm import Session

from db.models import AppSettings


def get_all(db: Session) -> dict[str, str | None]:
    rows = db.query(AppSettings).all()
    return {row.key: row.value for row in rows}


def get_value(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.get(AppSettings, key)
    return row.value if row is not None else default


def set_value(db: Session, key: str, value: str) -> None:
    row = db.get(AppSettings, key)
    if row is None:
        db.add(AppSettings(key=key, value=value))
    else:
        row.value = value
    db.commit()


def update_many(db: Session, updates: dict[str, str]) -> None:
    for key, value in updates.items():
        set_value(db, key, value)
