"""
Research agent.

Orchestrates: query formulation → web search → content fetch → LLM synthesis
with inline [N] citations.

Yields ResearchEvent objects which the SSE route serialises as:
  {"type": "status",  "message": "..."}
  {"type": "token",   "content": "..."}
  {"type": "sources", "sources": [...]}
  {"type": "done",    "full_content": "...", "sources": [...]}
  {"type": "error",   "message": "..."}
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import AsyncIterator

from core.ollama_client import OllamaClient
from core.web_search import WebSearchClient, SearchResult

logger = logging.getLogger(__name__)

# Maximum sources to include in synthesis
MAX_SOURCES = 5
# Characters of page content to feed per source
CONTENT_PER_SOURCE = 1500


@dataclass
class ResearchEvent:
    type: str  # status | token | sources | done | error
    message: str = ""
    content: str = ""
    sources: list[dict] = field(default_factory=list)
    full_content: str = ""


class ResearchAgent:
    """
    Multi-step research orchestrator.

    Steps:
      1. Ask LLM to generate 2-3 targeted search queries.
      2. Execute each query via WebSearchClient.
      3. Fetch full content for top results.
      4. Ask LLM to synthesise a cited answer using the collected sources.
      5. Stream the synthesis token by token.
    """

    def __init__(self, ollama: OllamaClient, search: WebSearchClient):
        self._ollama = ollama
        self._search = search

    async def conduct_research(
        self,
        question: str,
        model: str,
        system_prompt: str = "",
    ) -> AsyncIterator[ResearchEvent]:
        # ── Step 1: generate search queries ───────────────────────────────────
        yield ResearchEvent(type="status", message="Formulating search queries…")
        queries = await self._generate_queries(question, model)
        if not queries:
            yield ResearchEvent(type="error", message="Could not formulate search queries.")
            return

        # ── Step 2: execute searches ───────────────────────────────────────────
        if not self._search.available:
            yield ResearchEvent(
                type="error",
                message=(
                    "No Ollama API key. Add OLLAMA_API_KEY in Settings → Integrations."
                ),
            )
            return

        all_results: list[SearchResult] = []
        for q in queries:
            yield ResearchEvent(type="status", message=f"Searching: {q}")
            try:
                results = await self._search.search(q, count=3)
                all_results.extend(results)
            except Exception as exc:
                logger.warning("Search failed for query '%s': %s", q, exc)

        if not all_results:
            yield ResearchEvent(type="error", message="No search results found.")
            return

        # Deduplicate by URL, keep first occurrence
        seen: set[str] = set()
        unique: list[SearchResult] = []
        for r in all_results:
            if r.url not in seen:
                seen.add(r.url)
                unique.append(r)
        sources = unique[:MAX_SOURCES]

        # ── Step 3: fetch content ─────────────────────────────────────────────
        yield ResearchEvent(type="status", message=f"Reading {len(sources)} sources…")
        for src in sources:
            src.content = await self._search.fetch_content(src.url, max_chars=CONTENT_PER_SOURCE)

        # ── Step 4: synthesise ─────────────────────────────────────────────────
        yield ResearchEvent(type="status", message="Synthesising answer…")

        synthesis_prompt = _build_synthesis_prompt(question, sources)
        synthesis_messages = [{"role": "user", "content": synthesis_prompt}]

        collected: list[str] = []
        try:
            async for token in self._ollama.stream_chat(
                model=model,
                messages=synthesis_messages,
                system_prompt=(
                    "You are a research assistant. "
                    "Answer based ONLY on the provided sources. "
                    "NEVER invent, assume, or reference sources that were not given to you. "
                    "CITATION RULE: after each claim, write the source number inside square brackets. "
                    "The ONLY allowed formats are [1], [2], [3], etc. "
                    "NEVER write [N1], [N2], [Source 1], [Ref 1], (1), or any other variation. "
                    "Just a plain number inside square brackets: [1], [2], [3]."
                ),
            ):
                collected.append(token)
                yield ResearchEvent(type="token", content=token)
        except Exception as exc:
            yield ResearchEvent(type="error", message=f"Synthesis failed: {exc}")
            return

        full_content = "".join(collected)
        source_dicts = [s.to_dict() for s in sources]

        yield ResearchEvent(
            type="done",
            full_content=full_content,
            sources=source_dicts,
        )

    async def _generate_queries(self, question: str, model: str) -> list[str]:
        """Ask the LLM to produce 2-3 focused search queries as a JSON array."""
        prompt = (
            f"Generate 2-3 focused web search queries to research the following question.\n"
            f"Question: {question}\n\n"
            f'Return ONLY a JSON array of strings, e.g. ["query 1", "query 2"].'
        )
        tokens: list[str] = []
        try:
            async for token in self._ollama.stream_chat(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                system_prompt="You generate search queries. Reply only with a JSON array.",
            ):
                tokens.append(token)
                if len(tokens) > 200:
                    break
        except Exception as exc:
            logger.error("Query generation failed: %s", exc)
            return [question]  # Fall back to raw question

        raw = "".join(tokens).strip()
        # Extract JSON array from response
        try:
            start = raw.index("[")
            end = raw.rindex("]") + 1
            queries = json.loads(raw[start:end])
            if isinstance(queries, list):
                return [str(q) for q in queries[:3]]
        except (ValueError, json.JSONDecodeError):
            pass
        # If parsing fails, use the original question
        return [question]


def _build_synthesis_prompt(question: str, sources: list[SearchResult]) -> str:
    """Build the synthesis prompt with numbered source blocks."""
    lines = [
        f"Research question: {question}\n",
        "Sources:",
    ]
    for i, src in enumerate(sources, start=1):
        content_block = src.content if src.content else src.snippet
        lines.append(
            f"[{i}] {src.title} ({src.source})\n{content_block[:CONTENT_PER_SOURCE]}"
        )

    n = len(sources)
    valid = ", ".join(f"[{i}]" for i in range(1, n + 1))
    lines.append(
        f"\nThere are exactly {n} sources above, numbered 1 to {n}. "
        f"Valid citations are: {valid}. "
        f"NEVER cite a number outside the range 1–{n}. "
        "Write a comprehensive, well-structured answer using ONLY these sources. "
        "Citation format: place the source number in square brackets after each claim, "
        "for example [1] or [2]. "
        "Use ONLY that format — never [N1], [N2], [Source 1], (1), or anything else. "
        "If information conflicts across sources, note the discrepancy."
    )
    return "\n\n".join(lines)
