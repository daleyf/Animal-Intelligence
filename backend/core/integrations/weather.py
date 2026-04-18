"""
OpenWeatherMap integration.

Requires OPENWEATHERMAP_API_KEY in .env.
Free tier: 1,000 calls/day, 60 calls/minute.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://api.openweathermap.org/data/2.5"


@dataclass
class WeatherData:
    location: str
    temperature_c: float
    feels_like_c: float
    description: str
    humidity_pct: int
    wind_speed_ms: float
    icon: str  # e.g. "01d"
    forecast_high_c: float
    forecast_low_c: float
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "location": self.location,
            "temperature_c": round(self.temperature_c, 1),
            "feels_like_c": round(self.feels_like_c, 1),
            "description": self.description,
            "humidity_pct": self.humidity_pct,
            "wind_speed_ms": round(self.wind_speed_ms, 1),
            "icon": self.icon,
            "forecast_high_c": round(self.forecast_high_c, 1),
            "forecast_low_c": round(self.forecast_low_c, 1),
            "error": self.error,
        }

    def to_text(self) -> str:
        if self.error:
            return f"Weather unavailable: {self.error}"
        return (
            f"{self.location}: {self.description.capitalize()}, "
            f"{self.temperature_c:.0f}°C (feels like {self.feels_like_c:.0f}°C), "
            f"humidity {self.humidity_pct}%, wind {self.wind_speed_ms:.0f} m/s. "
            f"Today's range: {self.forecast_low_c:.0f}°C – {self.forecast_high_c:.0f}°C."
        )


class WeatherClient:
    def __init__(self):
        self._api_key = settings.openweathermap_api_key
        self._http = httpx.AsyncClient(timeout=8.0)

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def get_current(self, location: str) -> WeatherData:
        """
        Fetch current weather + daily high/low for *location*.
        *location* can be a city name, "city,country" or coordinates.
        """
        if not self._api_key:
            return WeatherData(
                location=location,
                temperature_c=0,
                feels_like_c=0,
                description="",
                humidity_pct=0,
                wind_speed_ms=0,
                icon="",
                forecast_high_c=0,
                forecast_low_c=0,
                error="OpenWeatherMap API key not configured.",
            )

        try:
            resp = await self._http.get(
                f"{BASE_URL}/weather",
                params={
                    "q": location,
                    "appid": self._api_key,
                    "units": "metric",
                },
            )
            resp.raise_for_status()
            data = resp.json()

            # fetch daily forecast for high/low
            high = data["main"]["temp_max"]
            low = data["main"]["temp_min"]

            return WeatherData(
                location=data.get("name", location),
                temperature_c=data["main"]["temp"],
                feels_like_c=data["main"]["feels_like"],
                description=data["weather"][0]["description"],
                humidity_pct=data["main"]["humidity"],
                wind_speed_ms=data["wind"]["speed"],
                icon=data["weather"][0]["icon"],
                forecast_high_c=high,
                forecast_low_c=low,
            )

        except httpx.HTTPStatusError as exc:
            msg = f"Weather API error {exc.response.status_code}"
            logger.warning(msg)
            return WeatherData(
                location=location, temperature_c=0, feels_like_c=0, description="",
                humidity_pct=0, wind_speed_ms=0, icon="", forecast_high_c=0,
                forecast_low_c=0, error=msg,
            )
        except Exception as exc:
            logger.warning("Weather fetch failed: %s", exc)
            return WeatherData(
                location=location, temperature_c=0, feels_like_c=0, description="",
                humidity_pct=0, wind_speed_ms=0, icon="", forecast_high_c=0,
                forecast_low_c=0, error=str(exc),
            )

    async def aclose(self) -> None:
        await self._http.aclose()


weather_client = WeatherClient()
