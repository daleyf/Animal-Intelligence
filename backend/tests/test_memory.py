"""
Unit tests for the memory store and research agent.

MemoryStore tests use a temporary ChromaDB directory (skipped if chromadb
is not installed so CI can run without the heavy dependency).
"""

import os
import tempfile
import pytest


# ── MemoryStore ───────────────────────────────────────────────────────────────

try:
    import chromadb  # noqa: F401
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False


@pytest.fixture
def store():
    """Fresh MemoryStore backed by a temporary directory."""
    if not CHROMA_AVAILABLE:
        pytest.skip("chromadb not installed")
    from core.memory_store import MemoryStore

    with tempfile.TemporaryDirectory() as tmpdir:
        yield MemoryStore(persist_directory=tmpdir)


class TestMemoryStore:
    def test_store_and_count(self, store):
        assert store.get_count() == 0
        mid = store.store_memory("Hello", "Hi there", "conv-1")
        assert mid is not None
        assert store.get_count() == 1

    def test_retrieve_relevant(self, store):
        store.store_memory(
            "What is the capital of France?",
            "The capital of France is Paris.",
            "conv-1",
        )
        store.store_memory(
            "How do I bake bread?",
            "Mix flour, water, salt, and yeast. Knead and proof.",
            "conv-2",
        )
        results = store.retrieve_relevant("Tell me about Paris", n_results=1)
        assert len(results) == 1
        assert "France" in results[0].document or "Paris" in results[0].document

    def test_list_all(self, store):
        for i in range(5):
            store.store_memory(f"Question {i}", f"Answer {i}", "conv-x")
        entries = store.list_all(limit=10)
        assert len(entries) == 5

    def test_delete_memory(self, store):
        mid = store.store_memory("Delete me", "Sure", "conv-del")
        assert store.get_count() == 1
        ok = store.delete_memory(mid)
        assert ok
        assert store.get_count() == 0

    def test_clear_all(self, store):
        store.store_memory("A", "B", "conv-a")
        store.store_memory("C", "D", "conv-b")
        assert store.get_count() == 2
        store.clear_all()
        assert store.get_count() == 0

    def test_memory_entry_to_dict(self, store):
        store.store_memory("What time is it?", "It is noon.", "conv-t")
        entries = store.list_all()
        d = entries[0].to_dict()
        assert "id" in d
        assert "document" in d
        assert "metadata" in d
        assert "relevance_score" in d

    def test_unavailable_store_returns_safe_defaults(self):
        """A store with a bad path should degrade gracefully, not raise."""
        # Import MemoryStore directly, not the singleton
        if not CHROMA_AVAILABLE:
            pytest.skip("chromadb not installed")
        from core.memory_store import MemoryStore

        store = MemoryStore(persist_directory="/nonexistent/path/that/cannot/be/created")
        # Should not raise — just be unavailable or available depending on OS
        result = store.store_memory("x", "y", "z")
        # If unavailable, returns None; if somehow available, returns a string
        assert result is None or isinstance(result, str)


# ── Research agent (unit-level — mocks LLM and search) ───────────────────────

class MockOllamaClient:
    """Minimal mock that yields canned tokens."""

    async def stream_chat(self, model, messages, system_prompt=""):
        # First call (query generation) returns a JSON array
        # Second call (synthesis) returns a sentence
        prompt = messages[0]["content"] if messages else ""
        if "JSON array" in prompt or "search queries" in prompt.lower():
            for ch in '["What is Python?", "Python programming language"]':
                yield ch
        else:
            for word in ["Python", " is", " a", " programming", " language", "."]:
                yield word


class MockSearchResult:
    def __init__(self):
        self.title = "Python (programming language)"
        self.url = "https://example.com/python"
        self.snippet = "Python is a high-level programming language."
        self.source = "example.com"
        self.content = "Python is a high-level, general-purpose programming language."

    def to_dict(self):
        return {
            "title": self.title,
            "url": self.url,
            "snippet": self.snippet,
            "source": self.source,
            "content": self.content[:500],
        }


class MockWebSearchClient:
    async def search(self, query, count=5):
        return [MockSearchResult()]

    async def fetch_content(self, url, max_chars=3000):
        return "Python is a general-purpose programming language."


@pytest.mark.asyncio
async def test_research_agent_full_flow():
    from core.research_agent import ResearchAgent

    agent = ResearchAgent(ollama=MockOllamaClient(), search=MockWebSearchClient())
    events = []
    async for event in agent.conduct_research("What is Python?", model="test-model"):
        events.append(event)

    types = [e.type for e in events]
    assert "status" in types
    assert "token" in types
    assert "done" in types

    done_event = next(e for e in events if e.type == "done")
    assert len(done_event.sources) > 0
    assert done_event.full_content != ""


@pytest.mark.asyncio
async def test_research_agent_query_generation():
    """Verify query generation falls back to raw question on parse failure."""
    from core.research_agent import ResearchAgent

    class BrokenQueryOllama:
        async def stream_chat(self, model, messages, system_prompt=""):
            # Returns garbage that can't be parsed as JSON array
            for ch in "not valid json at all":
                yield ch

    agent = ResearchAgent(ollama=BrokenQueryOllama(), search=MockWebSearchClient())
    queries = await agent._generate_queries("test question", "test-model")
    # Should fall back to the original question
    assert queries == ["test question"]
