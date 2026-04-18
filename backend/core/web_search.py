"""
Web search client.

Provider: Ollama Web Search API (ollama.com/api/web_search).
Requires a free Ollama account API key — create one at ollama.com/settings/keys
and set OLLAMA_API_KEY in .env.

Content fetching uses the companion Ollama Web Fetch API
(ollama.com/api/web_fetch), which returns clean plain text for a given URL.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from core.config import settings

logger = logging.getLogger(__name__)

OLLAMA_API_BASE = "https://ollama.com/api"
OLLAMA_SEARCH_PATH = "/web_search"
OLLAMA_FETCH_PATH = "/web_fetch"

_SEARCH_TIMEOUT = 10.0   # seconds
_FETCH_TIMEOUT = 12.0    # seconds — page fetch can be slower


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    source: str = ""   # domain name
    content: str = ""  # fetched page content (populated by fetch_content)

    def to_dict(self) -> dict:
        return {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
            "source": self.source,
            "content": self.content[:500] if self.content else "",
        }


class WebSearchClient:
    """
    Async web search + content fetching via the Ollama API.

    Usage:
        client = WebSearchClient()
        results = await client.search("Python async generators")
        for r in results:
            r.content = await client.fetch_content(r.url)
    """

    def __init__(self):
        self._http = httpx.AsyncClient(
            timeout=httpx.Timeout(_SEARCH_TIMEOUT),
            follow_redirects=True,
        )

    def _auth_headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {settings.ollama_api_key}"}

    async def search(self, query: str, count: int = 5) -> list[SearchResult]:
        """
        Search using the Ollama Web Search API.
        Returns [] if OLLAMA_API_KEY is not set or the request fails.
        """
        if not settings.ollama_api_key:
            logger.warning("OLLAMA_API_KEY not set — web search disabled.")
            return []
        try:
            resp = await self._http.post(
                f"{OLLAMA_API_BASE}{OLLAMA_SEARCH_PATH}",
                headers=self._auth_headers(),
                json={"query": query, "max_results": min(count, 10)},
                timeout=_SEARCH_TIMEOUT,
            )
            resp.raise_for_status()
            results: list[SearchResult] = []
            for item in resp.json().get("results", [])[:count]:
                url = item.get("url", "")
                results.append(
                    SearchResult(
                        title=item.get("title", ""),
                        url=url,
                        snippet=item.get("content", "")[:300],
                        source=_domain(url),
                    )
                )
            return results
        except Exception as exc:
            logger.error("Ollama web search failed: %s", exc)
            return []

    async def fetch_content(self, url: str, max_chars: int = 3000) -> str:
        """
        Fetch a URL via the Ollama Web Fetch API and return clean plain text.
        Returns an empty string on failure — never raises.
        """
        if not settings.ollama_api_key:
            return ""
        try:
            resp = await self._http.post(
                f"{OLLAMA_API_BASE}{OLLAMA_FETCH_PATH}",
                headers=self._auth_headers(),
                json={"url": url},
                timeout=_FETCH_TIMEOUT,
            )
            resp.raise_for_status()
            return resp.json().get("content", "")[:max_chars]
        except Exception as exc:
            logger.debug("fetch_content(%s) failed: %s", url, exc)
            return ""

    async def aclose(self) -> None:
        await self._http.aclose()


def _domain(url: str) -> str:
    """Extract bare domain from a URL."""
    try:
        import urllib.parse
        return urllib.parse.urlparse(url).netloc.lstrip("www.")
    except Exception:
        return ""


# Module-level singleton
web_search_client = WebSearchClient()
