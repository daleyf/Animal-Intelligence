"""
Ollama API client — the single point of contact with the local Ollama backend.
All LLM inference and model management goes through this module.
"""

import json
from typing import AsyncIterator

import httpx

from core.config import settings

# Curated list of recommended models with metadata.
# Ollama has no official catalog API, so we maintain this list for the UI.
KNOWN_MODELS: list[dict] = [
    {
        "name": "llama3.1:8b",
        "description": "Meta Llama 3.1 8B Instruct — great all-around model",
        "size_gb": 4.7,
        "min_ram_gb": 8,
    },
    {
        "name": "llama3.2:3b",
        "description": "Meta Llama 3.2 3B — fast, low memory usage",
        "size_gb": 2.0,
        "min_ram_gb": 4,
    },
    {
        "name": "mistral:7b",
        "description": "Mistral 7B v0.3 — strong reasoning and instruction following",
        "size_gb": 4.1,
        "min_ram_gb": 8,
    },
    {
        "name": "gemma2:9b",
        "description": "Google Gemma 2 9B — excellent for analysis tasks",
        "size_gb": 5.4,
        "min_ram_gb": 8,
    },
    {
        "name": "phi3:mini",
        "description": "Microsoft Phi-3 Mini 3.8B — fast on CPU",
        "size_gb": 2.2,
        "min_ram_gb": 4,
    },
    {
        "name": "qwen2.5:7b",
        "description": "Alibaba Qwen 2.5 7B — strong multilingual support",
        "size_gb": 4.4,
        "min_ram_gb": 8,
    },
]


class OllamaClient:
    """Async HTTP client wrapping the Ollama REST API."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        # Singleton client reused across requests for connection pooling.
        # No timeout on the client itself; set per-request.
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=None)

    async def is_running(self) -> bool:
        """Return True if Ollama is reachable."""
        try:
            response = await self._client.get("/", timeout=2.0)
            return response.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            return False

    async def list_installed_models(self) -> list[dict]:
        """Return list of installed models from Ollama /api/tags."""
        try:
            response = await self._client.get("/api/tags", timeout=5.0)
            response.raise_for_status()
            data = response.json()
            return data.get("models", [])
        except (httpx.HTTPError, Exception):
            return []

    async def stream_chat(
        self,
        model: str,
        messages: list[dict],
        system_prompt: str = "",
    ) -> AsyncIterator[str]:
        """
        Stream chat tokens from Ollama.

        Yields individual token strings as they arrive.
        messages format: [{"role": "user"|"assistant", "content": "..."}]
        """
        # Prepend the system prompt as a system message (more universally
        # compatible than the top-level "system" field, which is a Modelfile
        # override and can cause 500s on some models).
        full_messages: list[dict] = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        payload: dict = {
            "model": model,
            "messages": full_messages,
            "stream": True,
        }

        async for token in self._stream_chat_attempt(model, payload):
            yield token

    async def _stream_chat_attempt(
        self, model: str, payload: dict
    ) -> AsyncIterator[str]:
        """Inner streaming attempt; retries without system message on 500."""
        try:
            async with self._client.stream(
                "POST", "/api/chat", json=payload
            ) as response:
                if response.status_code == 404:
                    raise ValueError(
                        f"Model '{model}' not found in Ollama. "
                        f"Run: ollama pull {model}"
                    )
                if response.status_code >= 400:
                    body = await response.aread()
                    try:
                        detail = json.loads(body).get("error", body.decode())
                    except Exception:
                        detail = body.decode(errors="replace")

                    # Some models (e.g. Gemma 4) reject the system role in the
                    # messages array.  Retry once with the system message stripped.
                    if response.status_code == 500 and any(
                        msg.get("role") == "system" for msg in payload.get("messages", [])
                    ):
                        stripped = {
                            **payload,
                            "messages": [
                                m for m in payload["messages"] if m.get("role") != "system"
                            ],
                        }
                        async for token in self._stream_chat_attempt(model, stripped):
                            yield token
                        return

                    raise ValueError(
                        f"Ollama error {response.status_code} for model '{model}': {detail}"
                    )

                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        yield token

                    if chunk.get("done"):
                        break
        except httpx.ConnectError as exc:
            raise ConnectionError(
                "Cannot connect to Ollama. Make sure Ollama is running: `ollama serve`"
            ) from exc
        except httpx.TimeoutException as exc:
            raise TimeoutError("Ollama request timed out.") from exc

    async def pull_model(self, model_name: str) -> AsyncIterator[dict]:
        """
        Stream model download progress from Ollama /api/pull.

        Yields dicts: {"status": str, "completed": int|None, "total": int|None}
        """
        payload = {"name": model_name, "stream": True}
        try:
            async with self._client.stream(
                "POST", "/api/pull", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    yield {
                        "status": chunk.get("status", ""),
                        "completed": chunk.get("completed"),
                        "total": chunk.get("total"),
                    }
        except httpx.ConnectError as exc:
            raise ConnectionError("Cannot connect to Ollama.") from exc

    async def aclose(self) -> None:
        await self._client.aclose()


# Module-level singleton — shared across all requests.
ollama_client = OllamaClient(base_url=settings.ollama_base_url)
