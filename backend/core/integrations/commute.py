"""
Google Maps Directions API integration.

Requires GOOGLE_MAPS_API_KEY in .env.
Returns estimated commute time with live traffic conditions.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json"


@dataclass
class CommuteData:
    origin: str
    destination: str
    duration_minutes: int
    duration_in_traffic_minutes: int
    distance_km: float
    summary: str  # e.g. "via I-90 W"
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "origin": self.origin,
            "destination": self.destination,
            "duration_minutes": self.duration_minutes,
            "duration_in_traffic_minutes": self.duration_in_traffic_minutes,
            "distance_km": round(self.distance_km, 1),
            "summary": self.summary,
            "error": self.error,
        }

    def to_text(self) -> str:
        if self.error:
            return f"Commute data unavailable: {self.error}"
        traffic_note = ""
        diff = self.duration_in_traffic_minutes - self.duration_minutes
        if diff > 5:
            traffic_note = f" ({diff} min delay due to traffic)"
        elif diff < -5:
            traffic_note = " (lighter traffic than usual)"
        return (
            f"Commute {self.origin} → {self.destination}: "
            f"{self.duration_in_traffic_minutes} min{traffic_note} "
            f"via {self.summary} ({self.distance_km:.1f} km)."
        )


class CommuteClient:
    def __init__(self):
        self._api_key = settings.google_maps_api_key
        self._http = httpx.AsyncClient(timeout=8.0)

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def get_time(self, origin: str, destination: str) -> CommuteData:
        """Fetch current commute time with traffic for origin → destination."""
        if not self._api_key:
            return CommuteData(
                origin=origin,
                destination=destination,
                duration_minutes=0,
                duration_in_traffic_minutes=0,
                distance_km=0,
                summary="",
                error="Google Maps API key not configured.",
            )
        if not origin or not destination:
            return CommuteData(
                origin=origin,
                destination=destination,
                duration_minutes=0,
                duration_in_traffic_minutes=0,
                distance_km=0,
                summary="",
                error="Home or work location not set in profile.",
            )

        try:
            import time as _time

            resp = await self._http.get(
                DIRECTIONS_URL,
                params={
                    "origin": origin,
                    "destination": destination,
                    "departure_time": "now",
                    "traffic_model": "best_guess",
                    "key": self._api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            if data.get("status") != "OK":
                return CommuteData(
                    origin=origin, destination=destination, duration_minutes=0,
                    duration_in_traffic_minutes=0, distance_km=0, summary="",
                    error=data.get("status", "Unknown error"),
                )

            leg = data["routes"][0]["legs"][0]
            duration = leg.get("duration", {}).get("value", 0) // 60
            traffic = leg.get("duration_in_traffic", {}).get("value", duration * 60) // 60
            distance_m = leg.get("distance", {}).get("value", 0)
            summary = data["routes"][0].get("summary", "")

            return CommuteData(
                origin=origin,
                destination=destination,
                duration_minutes=duration,
                duration_in_traffic_minutes=traffic,
                distance_km=distance_m / 1000,
                summary=summary,
            )

        except Exception as exc:
            logger.warning("Commute fetch failed: %s", exc)
            return CommuteData(
                origin=origin, destination=destination, duration_minutes=0,
                duration_in_traffic_minutes=0, distance_km=0, summary="",
                error=str(exc),
            )

    async def aclose(self) -> None:
        await self._http.aclose()


commute_client = CommuteClient()
