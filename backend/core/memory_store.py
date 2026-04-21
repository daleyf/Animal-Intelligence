"""
ChromaDB-backed vector memory store.

Stores conversation exchanges as semantic embeddings and retrieves
relevant past context to inject into the LLM prompt.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from core.config import settings as _settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# Lazy import guard — ChromaDB is optional; memory degrades gracefully if missing.
try:
    import chromadb
    from chromadb.utils.embedding_functions import SentenceTransformerEmbeddingFunction

    _CHROMA_AVAILABLE = True
except ImportError:
    _CHROMA_AVAILABLE = False
    logger.warning("chromadb not installed — memory feature disabled.")


class MemoryEntry:
    """A single stored memory with its metadata."""

    def __init__(self, id: str, document: str, metadata: dict, distance: float = 0.0):
        self.id = id
        self.document = document
        self.metadata = metadata
        self.distance = distance

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "document": self.document,
            "metadata": self.metadata,
            "relevance_score": round(1.0 - self.distance, 4),
        }


class MemoryStore:
    """
    Manages semantic memory using ChromaDB with sentence-transformers embeddings.

    The memory collection stores user/assistant exchange pairs.  On each chat
    turn we:
      1. Retrieve the most relevant past exchanges (retrieve_relevant).
      2. Inject them into the LLM context window.
      3. Store the new exchange after the response is complete (store_memory).

    Uses all-MiniLM-L6-v2 (90 MB, downloaded on first use).
    """

    COLLECTION_NAME = "anchorpoint_memory"

    def __init__(self, persist_directory: str = "./chroma_db"):
        if not _CHROMA_AVAILABLE:
            self._available = False
            return

        try:
            self._client = chromadb.PersistentClient(path=persist_directory)
            self._ef = SentenceTransformerEmbeddingFunction(
                model_name="all-MiniLM-L6-v2"
            )
            self._collection = self._client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                embedding_function=self._ef,
                metadata={"hnsw:space": "cosine"},
            )
            self._available = True
            logger.info(
                "MemoryStore ready — %d existing memories.", self._collection.count()
            )
        except Exception as exc:
            self._available = False
            logger.error("MemoryStore init failed: %s", exc)

    @property
    def available(self) -> bool:
        return self._available

    # ── Write ──────────────────────────────────────────────────────────────────

    def store_memory(
        self,
        user_message: str,
        assistant_response: str,
        conversation_id: str,
    ) -> str | None:
        """
        Persist a user/assistant exchange as a memory entry.

        Returns the new memory ID, or None if the store is unavailable.
        """
        if not self._available:
            return None

        memory_id = str(uuid.uuid4())
        # The document text is what gets embedded and searched against.
        document = f"User: {user_message}\nAssistant: {assistant_response}"

        try:
            self._collection.add(
                documents=[document],
                metadatas=[
                    {
                        "conversation_id": conversation_id,
                        "user_message": user_message[:500],
                        "assistant_response": assistant_response[:500],
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                ],
                ids=[memory_id],
            )
        except Exception as exc:
            logger.error("store_memory failed: %s", exc)
            return None

        return memory_id

    # ── Read ───────────────────────────────────────────────────────────────────

    def retrieve_relevant(
        self, query: str, n_results: int = 3
    ) -> list[MemoryEntry]:
        """Return the N most semantically relevant past memories for *query*."""
        if not self._available:
            return []

        count = self._collection.count()
        if count == 0:
            return []

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=min(n_results, count),
                include=["documents", "metadatas", "distances"],
            )
        except Exception as exc:
            logger.error("retrieve_relevant failed: %s", exc)
            return []

        memories: list[MemoryEntry] = []
        for i, doc_id in enumerate(results["ids"][0]):
            memories.append(
                MemoryEntry(
                    id=doc_id,
                    document=results["documents"][0][i],
                    metadata=results["metadatas"][0][i],
                    distance=results["distances"][0][i],
                )
            )
        return memories

    def list_all(self, limit: int = 50, offset: int = 0) -> list[MemoryEntry]:
        """Return all stored memories (paginated) ordered by insertion."""
        if not self._available:
            return []

        count = self._collection.count()
        if count == 0:
            return []

        try:
            results = self._collection.get(
                limit=limit,
                offset=offset,
                include=["documents", "metadatas"],
            )
        except Exception as exc:
            logger.error("list_all failed: %s", exc)
            return []

        return [
            MemoryEntry(
                id=results["ids"][i],
                document=results["documents"][i],
                metadata=results["metadatas"][i],
            )
            for i in range(len(results["ids"]))
        ]

    def get_count(self) -> int:
        if not self._available:
            return 0
        try:
            return self._collection.count()
        except Exception:
            return 0

    # ── Delete ─────────────────────────────────────────────────────────────────

    def delete_memory(self, memory_id: str) -> bool:
        """Delete a single memory by ID. Returns True on success."""
        if not self._available:
            return False
        try:
            self._collection.delete(ids=[memory_id])
            return True
        except Exception as exc:
            logger.error("delete_memory failed: %s", exc)
            return False

    def clear_all(self) -> None:
        """Wipe and recreate the entire memory collection."""
        if not self._available:
            return
        try:
            self._client.delete_collection(self.COLLECTION_NAME)
            self._collection = self._client.get_or_create_collection(
                name=self.COLLECTION_NAME,
                embedding_function=self._ef,
                metadata={"hnsw:space": "cosine"},
            )
        except Exception as exc:
            logger.error("clear_all failed: %s", exc)


# Module-level singleton shared across all requests.
memory_store = MemoryStore(persist_directory=_settings.chroma_db_path)
