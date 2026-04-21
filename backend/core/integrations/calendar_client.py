"""
Google Calendar OAuth 2.0 integration.

Flow:
  1. GET  /report/calendar/auth      → returns {auth_url}
  2. User visits auth_url, Google redirects to GOOGLE_REDIRECT_URI?code=...
  3. Frontend sends code to POST /report/calendar/callback → stores token in DB
  4. GET  /report/calendar/events    → returns today's events

Tokens are stored in the google_calendar_tokens table (single row, id=1).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone

from core.config import settings

logger = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]


@dataclass
class CalendarEvent:
    title: str
    start: str      # ISO 8601 string
    end: str
    location: str
    description: str
    all_day: bool

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "start": self.start,
            "end": self.end,
            "location": self.location,
            "description": self.description,
            "all_day": self.all_day,
        }

    def to_text(self) -> str:
        if self.all_day:
            return f"• {self.title} (all day)"
        start_fmt = self.start[11:16] if len(self.start) > 10 else self.start
        end_fmt = self.end[11:16] if len(self.end) > 10 else self.end
        loc = f" at {self.location}" if self.location else ""
        return f"• {start_fmt}–{end_fmt}: {self.title}{loc}"


class CalendarClient:
    """Google Calendar API wrapper using OAuth 2.0."""

    def __init__(self):
        self._client_id = settings.google_client_id
        self._client_secret = settings.google_client_secret
        self._redirect_uri = settings.google_redirect_uri

    @property
    def configured(self) -> bool:
        return bool(self._client_id and self._client_secret)

    def get_auth_url(self) -> str:
        """Return the OAuth 2.0 consent page URL."""
        if not self.configured:
            raise ValueError("Google OAuth credentials not configured.")

        try:
            from google_auth_oauthlib.flow import Flow

            flow = Flow.from_client_config(
                client_config={
                    "web": {
                        "client_id": self._client_id,
                        "client_secret": self._client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [self._redirect_uri],
                    }
                },
                scopes=SCOPES,
                redirect_uri=self._redirect_uri,
            )
            auth_url, _ = flow.authorization_url(
                access_type="offline",
                include_granted_scopes="true",
                prompt="consent",
            )
            return auth_url
        except ImportError:
            raise RuntimeError(
                "google-auth-oauthlib not installed. Run: pip install google-auth-oauthlib"
            )

    def exchange_code(self, code: str) -> dict:
        """
        Exchange an auth code for access + refresh tokens.
        Returns a dict suitable for storing in GoogleCalendarToken.
        """
        if not self.configured:
            raise ValueError("Google OAuth credentials not configured.")

        try:
            from google_auth_oauthlib.flow import Flow

            flow = Flow.from_client_config(
                client_config={
                    "web": {
                        "client_id": self._client_id,
                        "client_secret": self._client_secret,
                        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                        "token_uri": "https://oauth2.googleapis.com/token",
                        "redirect_uris": [self._redirect_uri],
                    }
                },
                scopes=SCOPES,
                redirect_uri=self._redirect_uri,
            )
            flow.fetch_token(code=code)
            creds = flow.credentials
            return {
                "access_token": creds.token,
                "refresh_token": creds.refresh_token,
                "token_uri": creds.token_uri,
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "scopes": " ".join(creds.scopes or SCOPES),
            }
        except ImportError:
            raise RuntimeError("google-auth-oauthlib not installed.")

    def get_today_events(self, token_row) -> list[CalendarEvent]:
        """
        Fetch today's calendar events using stored token.
        *token_row* is a GoogleCalendarToken ORM row.
        """
        if not token_row or not token_row.connected:
            return []

        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            creds = Credentials(
                token=token_row.access_token,
                refresh_token=token_row.refresh_token,
                token_uri=token_row.token_uri or "https://oauth2.googleapis.com/token",
                client_id=token_row.client_id or self._client_id,
                client_secret=token_row.client_secret or self._client_secret,
                scopes=(token_row.scopes or " ".join(SCOPES)).split(),
            )

            service = build("calendar", "v3", credentials=creds)
            today = date.today()
            time_min = datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=timezone.utc).isoformat()
            time_max = datetime(today.year, today.month, today.day, 23, 59, 59, tzinfo=timezone.utc).isoformat()

            result = (
                service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min,
                    timeMax=time_max,
                    maxResults=20,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )

            events: list[CalendarEvent] = []
            for item in result.get("items", []):
                start = item["start"].get("dateTime", item["start"].get("date", ""))
                end = item["end"].get("dateTime", item["end"].get("date", ""))
                all_day = "dateTime" not in item["start"]
                events.append(
                    CalendarEvent(
                        title=item.get("summary", "(No title)"),
                        start=start,
                        end=end,
                        location=item.get("location", ""),
                        description=item.get("description", ""),
                        all_day=all_day,
                    )
                )
            return events

        except Exception as exc:
            logger.warning("Calendar fetch failed: %s", exc)
            return []


calendar_client = CalendarClient()
