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
from core.integrations.news import news_client, Headline
from core.integrations.calendar_client import calendar_client, CalendarEvent

if TYPE_CHECKING:
    from db.models import UserProfile
    from core.ollama_client import OllamaClient

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
    ) -> AsyncIterator[str]:
        """Yield LLM tokens forming the morning briefing."""

        # ── Gather all data sources in parallel ──────────────────────────────
        home = profile.home_location if profile else ""
        name = profile.name if profile else ""
        interests = list(profile.interests or []) if profile else []

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
        try:
            events = await asyncio.get_event_loop().run_in_executor(
                None, calendar_client.get_today_events, token_row
            )
        except Exception as exc:
            logger.warning("Calendar fetch failed: %s", exc)

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
