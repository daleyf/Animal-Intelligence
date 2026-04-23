"""
Integration test for the /health endpoint.

These tests use an in-memory SQLite DB and a mock Ollama client so no real
Ollama process is required.
"""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from main import app


# Health fixture
# -------------- #
@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


# Health endpoint test
# -------------- #
def test_health_endpoint_returns_ok(client):
    """Test that the /health endpoint returns status ok and includes version and Ollama connection status."""
    with patch(
        "core.ollama_client.OllamaClient.is_running",
        new_callable=AsyncMock,
        return_value=False,
    ):
        response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "ollama_connected" in data
