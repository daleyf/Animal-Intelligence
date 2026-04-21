"""
Morning report synthesis service.

Aggregates data from all four external integrations (weather, news, commute,
calendar) in parallel, then streams an LLM-generated briefing.

Yields token strings compatible with the SSE chat event format.
"""

from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, TYPE_CHECKING

from core.integrations.weather import weather_client, WeatherData
from core.integrations.news import news_client, Headline, DEFAULT_INTERESTS
from core.integrations.calendar_client import calendar_client, CalendarEvent

if TYPE_CHECKING:
    from db.models import UserProfile
    from core.ollama_client import OllamaClient
    from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class MorningReportService:
    """
    Gathers live data from all integrations and streams an LLM-synthesised
    morning briefing.  Each data source degrades gracefully — a missing API
    key simply omits that section from the report.
    """

    async def generate(
        self,
        profile: "UserProfile | None",
        token_row,            # GoogleCalendarToken ORM row or None
        model: str,
        ollama: "OllamaClient",
        db: "Session | None" = None,
        session_id: str | None = None,
    ) -> AsyncIterator[str]:
        """Yield LLM tokens forming the morning briefing."""

        # ── Gather all data sources in parallel ──────────────────────────────
        home = profile.home_location if profile else ""
        name = profile.name if profile else ""
        interests = list(profile.interests or []) if profile else []
        news_topics = (interests or DEFAULT_INTERESTS)[:3]

        weather_task = weather_client.get_current(home) if home else None
        news_task = news_client.get_headlines(interests=interests)

        tasks = []
        task_keys: list[str] = []

        if weather_task:
            tasks.append(weather_task)
            task_keys.append("weather")
        tasks.append(news_task)
        task_keys.append("news")

        results = await asyncio.gather(*tasks, return_exceptions=True)
        data: dict = {}
        for key, result in zip(task_keys, results):
            if isinstance(result, Exception):
                logger.warning("Report data fetch failed for %s: %s", key, result)
                data[key] = None
            else:
                data[key] = result

        # Calendar is synchronous (google-api-python-client uses blocking I/O)
        events: list[CalendarEvent] = []
        calendar_connected = getattr(token_row, "connected", False)
        try:
            events = await asyncio.get_event_loop().run_in_executor(
                None, calendar_client.get_today_events, token_row
            )
        except Exception as exc:
            logger.warning("Calendar fetch failed: %s", exc)

        # ── Log each integration call to the activity audit trail ─────────────
        if db is not None:
            from core.tool_logger import log_tool_call

            if home and weather_task:
                weather_result = data.get("weather")
                weather_ok = isinstance(weather_result, WeatherData) and not weather_result.error
                log_tool_call(
                    db, "weather",
                    input_summary=f"location={home!r}",
                    success=weather_ok,
                    error_message=weather_result.error if isinstance(weather_result, WeatherData) else None,
                    session_id=session_id,
                    data_destination="api.openweathermap.org",
                )

            news_result = data.get("news")
            log_tool_call(
                db, "news",
                input_summary=f"topics={news_topics!r}",
                success=isinstance(news_result, list),
                session_id=session_id,
                sub_queries=[f"{t} latest news today" for t in news_topics],
                data_destination="ollama.com/api/web_search",
            )

            if calendar_connected:
                log_tool_call(
                    db, "calendar",
                    input_summary="today's calendar events",
                    success=True,
                    session_id=session_id,
                    data_destination="google.com/calendar (Google Calendar API)",
                )

        # ── Build synthesis prompt ────────────────────────────────────────────
        prompt = _build_report_prompt(
            name=name,
            weather=data.get("weather"),
            news=data.get("news"),
            events=events,
        )

        system = (
            "You are a helpful morning briefing assistant. "
            "Write a concise, friendly, and natural-sounding morning report "
            "based on the data provided. Use a warm tone. "
            "Mention the user's name if available. "
            "For unavailable data, say so briefly and move on. "
            "Keep the report under 300 words."
        )

        # ── Stream LLM synthesis ──────────────────────────────────────────────
        try:
            async for token in ollama.stream_chat(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                system_prompt=system,
            ):
                yield token
        except Exception as exc:
            yield f"\n\n[Report generation failed: {exc}]"


def _build_report_prompt(
    name: str,
    weather: WeatherData | None,
    news: list[Headline] | None,
    events: list[CalendarEvent],
) -> str:
    parts: list[str] = []

    greeting = f"Good morning{', ' + name if name else ''}!"
    parts.append(greeting)

    if weather:
        parts.append(f"\n## Weather\n{weather.to_text()}")
    else:
        parts.append("\n## Weather\nWeather data unavailable.")

    if events:
        event_lines = "\n".join(e.to_text() for e in events)
        parts.append(f"\n## Today's Calendar\n{event_lines}")
    else:
        parts.append("\n## Today's Calendar\nNo calendar events today.")

    if news:
        headline_lines = "\n".join(h.to_text() for h in news[:6])
        parts.append(f"\n## Top Headlines\n{headline_lines}")
    else:
        parts.append("\n## Top Headlines\nNews unavailable.")

    parts.append(
        "\n---\nPlease synthesise the above into a natural, spoken-word morning briefing."
    )
    return "\n".join(parts)


morning_report_service = MorningReportService()
