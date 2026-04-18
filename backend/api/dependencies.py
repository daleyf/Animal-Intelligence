"""Shared FastAPI dependencies."""

from db.database import get_db
from core.ollama_client import ollama_client, OllamaClient


def get_ollama() -> OllamaClient:
    return ollama_client


__all__ = ["get_db", "get_ollama"]
