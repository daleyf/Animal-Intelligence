# Anchorpoint

**A privacy-first personal AI assistant powered entirely by your local LLM.**

Cloud AI makes you choose: privacy or performance. Anchorpoint doesn't. All inference, memory, and data stay on your machine — no accounts and no tracking.

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
- Full-page research interface at `/research` — ask a question, get a synthesized answer with cited web sources
- Results stream in real time into a chat-style thread; ask follow-up questions after the initial research completes
- Powered by the Ollama Web Search API — requires a free Ollama account API key
- Falls back gracefully when no API key is configured

**Daily Report**
- Daily briefing combining weather, personalized news headlines, and Google Calendar events
- Each generated report is saved as a persistent conversation — appears in the sidebar just like chat history
- Follow-up questions supported after generation: chat with your report using the local LLM
- News is fetched via the Ollama Web Search API using your profile interests — no separate news API key needed
- Auto-generation schedule configurable in **Settings → General** (toggle + UTC time picker)
- Each data source is optional — the report works with whatever integrations you have configured

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

All backend tests use in-memory SQLite and mock external services — no Ollama instance or API keys required.

---

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

Google Calendar integration uses OAuth 2.0. You need to create credentials in Google Cloud Console — this takes about 5 minutes.

**Step 1 — Create a Google Cloud project**

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project** → give it any name → **Create**

**Step 2 — Enable the Google Calendar API**

1. In your new project, go to **APIs & Services → Library**
2. Search for "Google Calendar API" → click it → **Enable**

**Step 3 — Create OAuth credentials**

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. If prompted, configure the OAuth consent screen first:
   - Choose **External** → fill in app name and your email → **Save and Continue** through remaining steps
4. Back on the Create OAuth client ID screen:
   - Application type: **Web application**
   - Name: anything (e.g. "Anchorpoint Local")
   - Under **Authorized redirect URIs**, click **+ Add URI** and enter:
     ```
     http://localhost:5173/settings/integrations
     ```
5. Click **Create** — you'll see your **Client ID** and **Client Secret**

**Step 4 — Add credentials to your `.env`**

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5173/settings/integrations
```

Restart the backend after saving.

**Step 5 — Connect in Anchorpoint**

Go to **Settings → Integrations** and click **Connect Google Calendar**. You'll be redirected to Google's consent screen, then returned to Anchorpoint automatically.

> If Google shows an "unverified app" warning during sign-in, click **Advanced → Go to [app name]** to proceed — this is expected for locally-run OAuth apps that haven't been through Google's verification process.

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
