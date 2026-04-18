"""
PII Sanitizer.

Strips or masks personally-identifiable information from strings before they
leave the device (e.g., web search queries sent to the Ollama Web Search API).

Patterns detected:
  - Email addresses       → [EMAIL]
  - Phone numbers (US)    → [PHONE]
  - Social security #s    → [SSN]
  - Street addresses      → [ADDRESS]
  - Profile-specific PII  → [NAME] / [HOME] / [WORK]  (pass via keyword args)

Usage:
    from core.pii_sanitizer import sanitize

    clean, changed = sanitize(
        "My name is John Smith, call 412-555-1234 or john@example.com",
        name="John Smith",
    )
    # clean  → "My name is [NAME], call [PHONE] or [EMAIL]"
    # changed → True
"""

from __future__ import annotations

import re

# ── Compiled patterns ──────────────────────────────────────────────────────────

_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
)

# North-American phone formats: (412) 555-1234 / 412-555-1234 / 412.555.1234 / +14125551234
_PHONE_RE = re.compile(
    r"\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
)

_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")

# Simple heuristic: number + capitalised word + road type suffix
_STREET_RE = re.compile(
    r"\b\d+\s+[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*"
    r"\s+(?:St|Ave|Blvd|Rd|Dr|Ln|Ct|Way|Pl|Circle|Court|Lane|Drive|Road|Street|Boulevard)\.?\b",
    re.IGNORECASE,
)

# ZIP / postal codes (US 5-digit, US ZIP+4, Canadian)
_ZIP_RE = re.compile(r"\b\d{5}(?:-\d{4})?\b|\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b")


def sanitize(
    text: str,
    *,
    name: str | None = None,
    home_location: str | None = None,
    work_location: str | None = None,
) -> tuple[str, bool]:
    """
    Return ``(sanitized_text, was_modified)``.

    Profile-specific strings are replaced first (exact match, case-insensitive)
    so that named locations like "Pittsburgh, PA" aren't exposed before the
    regex pass runs.
    """
    if not text:
        return text, False

    result = text

    # Pattern-based replacements run FIRST so that email addresses are already
    # masked before profile-name replacement runs — this prevents a name like
    # "Alice" from clobbering the local part of "alice@example.com".
    result = _SSN_RE.sub("[SSN]", result)
    result = _EMAIL_RE.sub("[EMAIL]", result)
    result = _PHONE_RE.sub("[PHONE]", result)
    result = _STREET_RE.sub("[ADDRESS]", result)
    result = _ZIP_RE.sub("[ZIP]", result)

    # Profile-specific replacements (after emails are masked)
    if name and name.strip():
        result = re.sub(
            r"\b" + re.escape(name.strip()) + r"\b", "[NAME]", result, flags=re.IGNORECASE
        )
    if home_location and home_location.strip():
        result = re.sub(
            re.escape(home_location.strip()), "[HOME]", result, flags=re.IGNORECASE
        )
    if work_location and work_location.strip():
        result = re.sub(
            re.escape(work_location.strip()), "[WORK]", result, flags=re.IGNORECASE
        )

    return result, result != text
