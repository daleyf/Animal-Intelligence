"""
Memory routes.

GET  /memory              → list all stored memories (paginated)
GET  /memory/count        → total memory count
POST /memory/search       → semantic search over memories
DELETE /memory/{id}       → delete one memory entry
DELETE /memory            → clear all memories
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from core.memory_store import memory_store

router = APIRouter()


class MemoryListResponse(BaseModel):
    memories: list[dict]
    total: int
    available: bool


class SearchRequest(BaseModel):
    query: str
    n_results: int = 5


@router.get("/memory", response_model=MemoryListResponse)
def list_memories(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Return all stored memories, most-recently-inserted first."""
    memories = memory_store.list_all(limit=limit, offset=offset)
    return MemoryListResponse(
        memories=[m.to_dict() for m in memories],
        total=memory_store.get_count(),
        available=memory_store.available,
    )


@router.get("/memory/count")
def memory_count():
    return {"count": memory_store.get_count(), "available": memory_store.available}


@router.post("/memory/search")
def search_memories(body: SearchRequest):
    """Semantic search over stored memories."""
    if not memory_store.available:
        raise HTTPException(status_code=503, detail="Memory store unavailable.")
    results = memory_store.retrieve_relevant(body.query, n_results=body.n_results)
    return {"results": [m.to_dict() for m in results]}


@router.delete("/memory/{memory_id}")
def delete_memory(memory_id: str):
    """Delete a single memory entry by ID."""
    if not memory_store.available:
        raise HTTPException(status_code=503, detail="Memory store unavailable.")
    success = memory_store.delete_memory(memory_id)
    if not success:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return {"deleted": memory_id}


@router.delete("/memory")
def clear_memories():
    """Permanently delete all stored memories."""
    if not memory_store.available:
        raise HTTPException(status_code=503, detail="Memory store unavailable.")
    memory_store.clear_all()
    return {"cleared": True}
