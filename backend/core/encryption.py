"""
Encryption utilities.

Provides transparent AES-128-CBC + HMAC-SHA256 encryption (via Fernet) for
sensitive fields stored in SQLite (Google Calendar OAuth tokens, etc.).

Key resolution order:
  1. ENCRYPTION_KEY env var (base64url Fernet key, 44 chars)
  2. .secret_key file next to this module (auto-created on first run)

The .secret_key file is generated automatically and should NEVER be committed
to source control (.gitignore already excludes it).

Usage:
    from core.encryption import encrypt_field, decrypt_field

    token_row.access_token = encrypt_field(raw_token)
    raw_token = decrypt_field(token_row.access_token)
"""

from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Key file lives next to this source file (backend/core/.secret_key)
_KEY_FILE = Path(__file__).parent.parent / ".secret_key"

_fernet = None  # lazy-initialised singleton


def _get_fernet():
    global _fernet
    if _fernet is not None:
        return _fernet

    try:
        from cryptography.fernet import Fernet
    except ImportError:
        logger.error("cryptography package not installed — encryption unavailable")
        return None

    # 1. Environment variable
    from core.config import settings
    raw_key: str | None = getattr(settings, "encryption_key", None)

    # 2. Key file
    if not raw_key:
        if _KEY_FILE.exists():
            raw_key = _KEY_FILE.read_text().strip()
        else:
            # Auto-generate and persist
            raw_key = Fernet.generate_key().decode()
            try:
                _KEY_FILE.write_text(raw_key)
                logger.info("Generated new encryption key at %s", _KEY_FILE)
            except OSError as exc:
                logger.warning("Could not persist encryption key: %s", exc)

    if not raw_key:
        return None

    try:
        _fernet = Fernet(raw_key.encode() if isinstance(raw_key, str) else raw_key)
    except Exception as exc:
        logger.error("Invalid encryption key: %s", exc)
        return None

    return _fernet


def encrypt_field(value: str | None) -> str | None:
    """
    Encrypt *value* and return a base64-encoded ciphertext string.
    Returns None if value is None; returns plaintext if encryption unavailable.
    """
    if value is None:
        return None
    f = _get_fernet()
    if f is None:
        return value  # Graceful degradation — store as-is
    try:
        return f.encrypt(value.encode()).decode()
    except Exception as exc:
        logger.error("Encryption failed: %s", exc)
        return value


def decrypt_field(value: str | None) -> str | None:
    """
    Decrypt a ciphertext produced by ``encrypt_field``.
    Returns None if value is None; returns value as-is on any error
    (handles the migration case where a field was stored as plaintext).
    """
    if value is None:
        return None
    f = _get_fernet()
    if f is None:
        return value
    try:
        return f.decrypt(value.encode()).decode()
    except Exception:
        # Not a valid Fernet token — likely a legacy plaintext value
        return value
