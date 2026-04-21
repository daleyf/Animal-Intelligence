# Anchorpoint

**A privacy-first personal AI assistant powered entirely by your local LLM.**

Cloud AI makes you choose: privacy or performance. Anchorpoint doesn't. All inference, memory, and data stay on your machine — no accounts, no API keys, no tracking.

---

## Features

**Core Chat**
- Real-time streaming chat with any Ollama model
- Persistent conversation history with search and soft-delete
- User profile and personalization context injected into every request
- Model management: browse installed models, download new ones with progress, switch mid-session
- Onboarding wizard for first-time setup

**Memory**
- Vector memory via ChromaDB: Anchorpoint remembers past conversations and automatically injects relevant context into new ones
- Embedding runs locally using `all-MiniLM-L6-v2` (downloaded on first start, ~90 MB)

**Research**
- Research panel: ask a question, get a synthesized answer with cited web sources
- Powered by the Ollama Web Search API — requires a free Ollama account API key
- Falls back gracefully when no API key is configured

**Morning Report**
- Daily briefing combining weather, personalized news headlines, and Google Calendar events
- News is fetched via the Ollama Web Search API using your profile interests — no separate news API key needed
- Scheduled auto-generation at a configurable time; latest report available on demand
- Each data source is optional — the report works with whatever APIs you have configured

**Voice Output**
- Read any assistant message aloud using the browser's Web Speech API
- No model download required — fully local TTS
- Configurable rate, pitch, and voice profile (Neutral / Warm / Professional)
- Create and save custom voice profiles

**Activity Log**
- Every external tool call (web search, memory, weather, news, commute, calendar) is logged with timing and success/failure status
- Visible at `/activity`

**Privacy & Security**
- PII sanitization on outbound queries (emails, phone numbers, SSNs, street addresses, and profile-specific data are masked before leaving the device)
- Google Calendar OAuth tokens encrypted at rest using Fernet symmetric encryption
- Hardware-aware model recommendation: Anchorpoint detects available RAM and suggests an appropriate model tier

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | Python 3.13 + FastAPI               |
| Frontend    | React 18 + TypeScript + Vite        |
| Database    | SQLite (SQLAlchemy ORM)             |
| Vector DB   | ChromaDB (local, no server needed)  |
| LLM Backend | Ollama (local)                      |
| Streaming   | Server-Sent Events (SSE)            |

---

## Getting Started

### Step 1 — Install Ollama

Ollama runs LLMs locally on your machine. Anchorpoint requires it to function.

Download and install from [ollama.com/download](https://ollama.com/download).

- **macOS**: `brew install ollama` also works

---

### Step 2 — Start Ollama and pull a model

```bash
ollama serve
ollama pull llama3.2:3b   # ~4.7 GB — adjust based on your hardware
```

- **Windows**: Ollama starts automatically after installation — skip `ollama serve`

Ollama must be running whenever you use Anchorpoint. Verify at `http://localhost:11434`.

The Settings → Models page will recommend a model based on your available RAM.

---

### Step 3 — Clone and configure

```bash
git clone <repo-url>
cd Animal-Intelligence
cp .env.example backend/.env
```

- **Windows (Command Prompt)**: Use `copy .env.example backend\.env`

The defaults in `.env.example` are enough to get started. Optional integrations (weather, news, commute, calendar, web search) can be enabled by adding API keys later.

---

### Step 4 — Start the backend

#### For Windows
Requires **Python 3.12.X**

#### For Mac
Requires **Python 3.13+**.

```bash
cd backend
python3 -m venv .venv              # Windows: py -3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Backend runs at `http://localhost:8000`. Health check: `GET /health`.

> The first start downloads the ChromaDB embedding model (~90 MB). Subsequent starts are instant.

---

### Step 5 — Start the frontend

Requires **Node.js 20+**.

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The onboarding wizard will guide you through the rest.

---

## Running Tests

### Backend

```bash
cd backend
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pytest                                          # all tests
pytest -v                                       # verbose
pytest tests/test_chat_routes.py               # single file
pytest --cov=core --cov=db --cov=api --cov-report=term-missing  # with coverage
```

### Frontend

```bash
cd frontend

npm test          # headless, all tests
npm run test:ui   # chrome for testing
```


## Optional Integrations

All integrations are disabled by default. Enable them by adding the relevant keys to `backend/.env`.

### Web Search & Personalized News (Ollama API)

The research panel and morning report news section both use the Ollama Web Search API. Morning report headlines are automatically tailored to your profile interests.

1. Create a free account at [ollama.com](https://ollama.com)
2. Generate an API key at [ollama.com/settings/keys](https://ollama.com/settings/keys)
3. Add to `backend/.env`:

```
OLLAMA_API_KEY=your_key_here
```

Set your interests in **Settings → Profile** to personalize morning report news topics.

### Weather (OpenWeatherMap)

```
OPENWEATHERMAP_API_KEY=your_key_here
```

Free tier at [openweathermap.org](https://openweathermap.org/api).

### Google Calendar

Follow the OAuth setup in `docs/design.md`, then connect via **Settings → Morning Report → Connect Google Calendar**.

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
pytest
```

All tests use in-memory SQLite and mock external services — no Ollama instance or API keys required.

---

## Project Structure

```
Animal-Intelligence/
├── backend/
│   ├── main.py               # FastAPI app entry point
│   ├── requirements.txt
│   ├── api/routes/           # Route handlers (chat, conversations, voice, report, etc.)
│   ├── core/                 # Ollama client, prompt builder, web search, integrations
│   ├── db/                   # SQLAlchemy models and CRUD layer
│   └── tests/                # pytest suite
├── frontend/
│   └── src/
│       ├── api/              # Fetch helpers and SSE client
│       ├── components/       # React components
│       ├── hooks/            # TanStack Query + Zustand hooks
│       └── store/            # Zustand global state
├── docs/                     # Architecture and planning documents
├── .env.example              # Environment variable template
└── CLAUDE.md                 # Developer guide for AI-assisted development
```

---

## Architecture Principles

- **UI never calls tools directly** — all LLM and tool interactions go through the FastAPI backend
- **Local-first** — all data (conversations, profile, memory vectors) stored on-device in SQLite and ChromaDB
- **No PII leaves the device** — queries are sanitized before hitting external services; Ollama inference is fully local
- **Graceful degradation** — every external integration (weather, news, commute, calendar, web search, ChromaDB) fails silently so the assistant always responds

---

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python      | 3.13+   | Backend |
| Node.js     | 20+     | Frontend |
| Ollama      | Latest  | Must be running locally |

---

## Team

| Name          | Role                         |
|---------------|------------------------------|
| Haiden Hunter | Scrum Master / Product Owner |
| Daley Fraser  | Lead Software Engineer       |
| Dante Samarco | UX & Engagement Engineer     |
| Gavin Fehl    | Test Engineer                |
