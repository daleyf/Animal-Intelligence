"""
OpenWeatherMap integration.

Uses two standard free-tier endpoints (no special subscription required):
  1. Current Weather API  → current conditions by city name
  2. 5-Day Forecast API   → today's high/low temperature range

The previous implementation used One Call API 3.0, which requires a
*separate* subscription even on the free tier — causing 401 errors for
users with standard free-tier API keys.  This version uses the basic
endpoints that work with any valid free-tier key.

Requires OPENWEATHERMAP_API_KEY in .env.
Both endpoints: 1,000 calls/day on the free tier.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

CURRENT_URL = "https://api.openweathermap.org/data/2.5/weather"
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"


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
        self._http = httpx.AsyncClient(timeout=10.0)

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def get_current(self, location: str) -> WeatherData:
        """
        Fetch current weather + today's forecast high/low for *location*.

        Steps:
          1. Current Weather API: city name → current conditions + display name
          2. 5-Day Forecast API: city name → today's min/max temperature range

        Both endpoints accept the city name directly — no geocoding step needed.
        Both are available on the standard free tier without a special subscription.
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
            # Step 1: Current conditions
            resp = await self._http.get(
                CURRENT_URL,
                params={
                    "q": location,
                    "appid": self._api_key,
                    "units": "metric",
                },
            )
            resp.raise_for_status()
            current = resp.json()

            # Step 2: 5-day / 3-hour forecast — first 8 periods covers today
            forecast_resp = await self._http.get(
                FORECAST_URL,
                params={
                    "q": location,
                    "appid": self._api_key,
                    "units": "metric",
                    "cnt": 8,  # 8 × 3 h = 24 h ahead
                },
            )
            forecast_resp.raise_for_status()
            forecast = forecast_resp.json()

            # Filter forecast items to today (UTC date) and extract high/low
            today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            today_items = [
                item for item in forecast.get("list", [])
                if item.get("dt_txt", "").startswith(today_str)
            ]

            if today_items:
                forecast_high = max(item["main"]["temp_max"] for item in today_items)
                forecast_low = min(item["main"]["temp_min"] for item in today_items)
            else:
                # No forecast items for today — use current temp as fallback
                forecast_high = current["main"]["temp"]
                forecast_low = current["main"]["temp"]

            # Build display name from response (city + country code)
            city_name = current.get("name", location)
            country = current.get("sys", {}).get("country", "")
            display_name = f"{city_name}, {country}" if country else city_name

            return WeatherData(
                location=display_name,
                temperature_c=current["main"]["temp"],
                feels_like_c=current["main"]["feels_like"],
                description=current["weather"][0]["description"],
                humidity_pct=current["main"]["humidity"],
                wind_speed_ms=current["wind"]["speed"],
                icon=current["weather"][0]["icon"],
                forecast_high_c=forecast_high,
                forecast_low_c=forecast_low,
            )

        except httpx.HTTPStatusError as exc:
            msg = f"Weather API error {exc.response.status_code}"
            try:
                detail = exc.response.json().get("message", "")
                if detail:
                    msg += f": {detail}"
            except Exception:
                pass
            logger.warning("Weather fetch failed: %s", msg)
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
