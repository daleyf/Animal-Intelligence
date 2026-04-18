"""
NewsAPI integration.

Requires NEWS_API_KEY in .env.
Free tier: 100 requests/day, top-headlines endpoint.
Docs: https://newsapi.org/docs/endpoints/top-headlines
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

BASE_URL = "https://newsapi.org/v2/top-headlines"
DEFAULT_CATEGORIES = ["technology", "science", "general"]


@dataclass
class Headline:
    title: str
    source: str
    url: str
    description: str
    published_at: str

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "source": self.source,
            "url": self.url,
            "description": self.description,
            "published_at": self.published_at,
        }

    def to_text(self) -> str:
        desc = f" — {self.description}" if self.description else ""
        return f"• {self.title} ({self.source}){desc}"


class NewsClient:
    def __init__(self):
        self._api_key = settings.news_api_key
        self._http = httpx.AsyncClient(timeout=8.0)

    @property
    def available(self) -> bool:
        return bool(self._api_key)

    async def get_headlines(
        self,
        categories: list[str] | None = None,
        count: int = 8,
        country: str = "us",
    ) -> list[Headline]:
        """
        Fetch top headlines for the given categories.
        If categories is empty or None, uses DEFAULT_CATEGORIES.
        """
        if not self._api_key:
            return []

        cats = categories or DEFAULT_CATEGORIES
        # NewsAPI supports one category per call — use the first category only
        # (multiple calls would exhaust the free quota quickly)
        category = cats[0] if cats else "general"

        try:
            resp = await self._http.get(
                BASE_URL,
                params={
                    "category": category,
                    "country": country,
                    "pageSize": count,
                    "apiKey": self._api_key,
                },
            )
            resp.raise_for_status()
            data = resp.json()

            headlines: list[Headline] = []
            for article in data.get("articles", [])[:count]:
                headlines.append(
                    Headline(
                        title=article.get("title", ""),
                        source=article.get("source", {}).get("name", ""),
                        url=article.get("url", ""),
                        description=article.get("description", "") or "",
                        published_at=article.get("publishedAt", "")[:10],
                    )
                )
            return headlines

        except Exception as exc:
            logger.warning("News fetch failed: %s", exc)
            return []

    async def aclose(self) -> None:
        await self._http.aclose()


news_client = NewsClient()
