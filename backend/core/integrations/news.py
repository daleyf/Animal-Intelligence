"""
Personalized news via Ollama Web Search.

Uses the user's interests from their profile to search for relevant news
headlines. Powered by the same Ollama Web Search API used for research —
no separate API key or external news service required.

Falls back gracefully when OLLAMA_API_KEY is not configured.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_INTERESTS = ["technology", "science", "world news"]


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


class PersonalizedNewsClient:
    """
    Fetches news headlines tailored to the user's interests using the Ollama
    Web Search API. Searches up to 3 interest topics, deduplicates by URL,
    and returns a flat list of Headline objects.
    """

    @property
    def available(self) -> bool:
        return bool(settings.ollama_api_key)

    async def get_headlines(
        self,
        interests: list[str] | None = None,
        count: int = 8,
    ) -> list[Headline]:
        """
        Search for news headlines based on user interests.

        Args:
            interests: List of interest topics from the user's profile.
                       Falls back to DEFAULT_INTERESTS if empty or None.
            count: Maximum number of headlines to return.

        Returns:
            List of Headline objects, deduped by URL.
        """
        if not settings.ollama_api_key:
            return []

        # Import here to avoid circular imports at module load
        from core.web_search import web_search_client

        topics = (interests or DEFAULT_INTERESTS)[:3]
        seen_urls: set[str] = set()
        headlines: list[Headline] = []

        for topic in topics:
            try:
                results = await web_search_client.search(
                    f"{topic} latest news today", count=3
                )
                for r in results:
                    if r.url not in seen_urls:
                        seen_urls.add(r.url)
                        headlines.append(
                            Headline(
                                title=r.title,
                                source=r.source,
                                url=r.url,
                                description=r.snippet,
                                published_at="",
                            )
                        )
                        if len(headlines) >= count:
                            return headlines
            except Exception as exc:
                logger.warning("News search failed for topic %r: %s", topic, exc)

        return headlines


news_client = PersonalizedNewsClient()
