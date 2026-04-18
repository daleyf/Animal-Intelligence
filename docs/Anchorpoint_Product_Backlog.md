# Anchorpoint — Full Product Backlog

---

## Epic 1: Project Setup & Infrastructure

---

### SP: 3 | Initialize Project Repository and Dev Environment

### User Story
As a developer, I want a fully configured project repository with a standard folder structure, README, and .gitignore, so that all team members can clone and begin development immediately.

### Requirements
- Create GitHub repository with branch protection on main.
- Define folder structure (frontend/, backend/, config/, tests/, docs/).
- Add README with setup instructions, tech stack overview, and contribution guidelines.
- Add .gitignore for Python, Node, and IDE-specific files.
- Configure linting (ESLint for frontend, flake8/black for backend).

### Notes
Haiden to own repo setup. All team members should be able to clone, install dependencies, and run a hello-world check within 30 minutes of setup.

---

### SP: 3 | Set Up Ollama Integration and Local LLM Baseline

### User Story
As a developer, I want Ollama installed and configured with a default model, so that the team has a working local LLM inference backend to build against.

### Requirements
- Install and configure Ollama on all team members' machines.
- Pull a default model (e.g., Llama 3.1 7B or Mistral 7B quantized).
- Write a simple Python script that sends a prompt to Ollama's REST API (localhost:11434) and prints the response.
- Document the model selection rationale and hardware requirements.

### Notes
Daley to lead. This is the foundational dependency — nothing else works without it. Test on at least two different hardware configs.

---

### SP: 5 | Set Up Backend API Framework

### User Story
As a developer, I want a backend API framework with defined endpoints and a modular structure, so that the frontend and all services communicate through a clean API layer.

### Requirements
- Set up a Python backend using FastAPI (or Flask).
- Define initial route structure: /chat, /models, /settings, /memory, /report.
- Implement health check endpoint.
- Add CORS configuration for local frontend communication.
- Set up environment variable management (.env).

### Notes
This enforces NFR-10 (UI never directly calls tools). All modules must go through this layer.

---

### SP: 3 | Set Up ChromaDB Database and Data Access Layer

### User Story
As a developer, I want a local ChromaDB instance with a data access layer, so that all persistent data (conversations, profiles, settings, memory) is stored reliably and accessed through a unified interface.

### Requirements
- Create ChromaDB collections for conversations, messages, user_profile, voice_profiles, and memory.
- Implement DataAccessLayer class with CRUD methods for each collection.
- Define consistent metadata schemas for each collection.
- Add data versioning strategy.

### Notes
Matches Section 3.6 of the SRS. No module should query ChromaDB directly — everything goes through the DAL.

---

### SP: 5 | Set Up Frontend Application Shell

### User Story
As a developer, I want a frontend application shell with routing and a base layout, so that all UI features can be built within a consistent framework.

### Requirements
- Initialize frontend (React + Electron or Tauri for desktop).
- Implement base layout: sidebar navigation, main content area, settings panel.
- Set up routing for Chat, Morning Report, Settings, and Activity Log views.
- Connect frontend to backend health check endpoint to verify communication.
- Apply initial design system (color palette, typography, spacing).

### Notes
Dante to lead. Should feel polished from the start — sets the bar for UX quality.

---

## Epic 2: Core Chat Interface

---

### SP: 8 | Build Real-Time Chat Interface

### User Story
As a user, I want a chat interface where I can type messages and receive streamed responses from my local LLM, so that I can have real-time conversations with Anchorpoint.

### Requirements
- Chat input box with send button and Enter key support.
- Message display area with user/assistant message bubbles.
- Streaming response rendering (token by token as they arrive from Ollama).
- Auto-scroll to latest message.
- Loading indicator while LLM is generating.
- Stop generation button to cancel in-progress responses.

### Notes
This is FR-01. The core interaction — must feel as responsive as ChatGPT. Streaming is critical for perceived performance.

---

### SP: 5 | Implement Chat Backend with Ollama Streaming

### User Story
As a developer, I want the backend to forward user messages to Ollama and stream responses back to the frontend, so that the chat interface can display tokens in real time.

### Requirements
- POST /chat endpoint accepts message and conversation context.
- Forward prompt to Ollama /api/chat with stream=true.
- Use Server-Sent Events (SSE) or WebSocket to stream tokens to frontend.
- Handle Ollama errors (model not loaded, timeout) with meaningful error messages.
- Respect context window limits — truncate oldest messages if context exceeds model limit.

### Notes
Daley to lead. Test with various prompt lengths to verify context truncation works correctly.

---

### SP: 3 | Persist Conversation History

### User Story
As a user, I want my conversations saved locally, so that I can return to previous chats and pick up where I left off.

### Requirements
- Auto-save each message to the ChromaDB messages collection as it's sent/received.
- Create new conversation record on first message.
- Auto-generate conversation title from first user message (use LLM to summarize).
- Display conversation list in sidebar sorted by most recent.

### Notes
FR-09. Conversations are stored locally only — no cloud sync.

---

### SP: 3 | Search and Manage Conversation History

### User Story
As a user, I want to search my past conversations and delete ones I no longer need, so that I can find information quickly and manage my data.

### Requirements
- Search bar in sidebar that filters conversations by title and message content.
- Delete individual conversations with confirmation dialog.
- Clear all history option in settings.
- Display conversation date and preview text in sidebar.

### Notes
FR-09 continued.

---

## Epic 3: Model Management

---

### SP: 5 | Build Model Selection and Download Interface

### User Story
As a user, I want to browse available LLM models, see their hardware requirements, and download the one that fits my machine, so that I can choose the best model for my setup.

### Requirements
- Settings > Models page listing installed and available models.
- For each model: display name, parameter count, size on disk, minimum RAM/VRAM.
- Download button with progress bar for uninstalled models.
- Set active model button for installed models.
- Query Ollama API (/api/tags for installed, library for available).

### Notes
FR-08. Daley to lead. Critical for onboarding — users need to understand what their hardware can run.

---

### SP: 3 | Implement Model Switching Without Restart

### User Story
As a user, I want to switch between installed models without restarting the application, so that I can try different models for different tasks.

### Requirements
- Dropdown or selector in chat header showing active model.
- Switching models mid-conversation starts a new conversation.
- Backend calls Ollama to load the new model.
- Show loading state while model loads.
- Persist last-used model in user_profile for next launch.

### Notes
FR-08 continued. Model loading can take 10-30 seconds — make the wait clear to users.

---

## Epic 4: Contextual Memory

---

### SP: 5 | Set Up ChromaDB Memory Collection and Embedding Pipeline

### User Story
As a developer, I want a dedicated ChromaDB memory collection with an embedding pipeline, so that the system can store and query user context using semantic search.

### Requirements
- Create a dedicated anchorpoint_memory collection within the existing ChromaDB instance.
- Select and configure an embedding model (e.g., all-MiniLM-L6-v2 via sentence-transformers).
- Implement MemoryStore class with storeMemory(), retrieveRelevant(), deleteMemory(), clearAll().
- Set similarity threshold and max results as configurable parameters.

### Notes
Class 3.4.4 in SRS. This is the foundation for contextual memory (FR-07).

---

### SP: 5 | Integrate Memory Retrieval into Chat Flow

### User Story
As a user, I want Anchorpoint to remember context from my past conversations and use it to give better answers, so that the assistant feels like it actually knows me.

### Requirements
- On each user message, generate embedding and query ChromaDB for relevant past context.
- If relevant memories found (above similarity threshold), prepend them to the LLM prompt.
- After each exchange, store the user message and assistant response as new memory entries.
- Include metadata (timestamp, conversation ID, topic tags) with each memory entry.

### Notes
UC-03 in SRS. The memory injection must stay within the model's context window — prioritize most relevant entries if space is limited.

---

### SP: 3 | Build Memory Management UI

### User Story
As a user, I want to view, search, and delete my stored memories, so that I can control what Anchorpoint remembers about me.

### Requirements
- Settings > Memory page listing stored memory entries.
- Search bar to filter memories by keyword.
- Delete individual entries or clear all memories.
- Display metadata (date, source conversation) for each entry.
- Toggle to enable/disable memory retrieval globally.

### Notes
Privacy is core to the product — users must feel in control of their data.

---

## Epic 5: Private Personalization

---

### SP: 3 | Build User Profile Setup Flow

### User Story
As a user, I want to enter my personal details (name, preferences, projects, goals) during onboarding, so that Anchorpoint can personalize responses from the start.

### Requirements
- First-launch onboarding wizard: name, home/work location, key interests/projects.
- Store all data in local user_profile table.
- Allow skipping onboarding (can fill in later via settings).
- Settings > Profile page to edit all personalization data at any time.

### Notes
FR-02. All data stays local — emphasize this to the user in the onboarding UI.

---

### SP: 3 | Inject Personalization Context into LLM Prompts

### User Story
As a user, I want Anchorpoint to use my profile information when responding, so that answers are tailored to my name, location, projects, and preferences.

### Requirements
- Build system prompt template that includes relevant user profile fields.
- UserProfile.getPersonalizationContext() method returns formatted context string.
- Inject personalization context into every LLM prompt automatically.
- Allow users to toggle personalization on/off in settings.

### Notes
FR-02 continued. Keep the injected context concise — don't waste tokens on irrelevant profile fields.

---

## Epic 6: Morning Report

---

### SP: 5 | Implement Calendar API Integration

### User Story
As a user, I want Anchorpoint to access my calendar events, so that my morning report includes today's schedule.

### Requirements
- Integrate with Google Calendar API using OAuth 2.0.
- Fetch today's events (title, time, location, description).
- Handle auth flow: redirect to Google, store refresh token locally.
- Handle API errors gracefully (token expired, no events, rate limit).
- Settings page to connect/disconnect calendar.

### Notes
Part of FR-03. OAuth tokens stored locally only. Refresh token management is important.

---

### SP: 3 | Implement Weather API Integration

### User Story
As a user, I want Anchorpoint to include current weather and forecast in my morning report, so that I can plan my day accordingly.

### Requirements
- Integrate with OpenWeatherMap API (free tier).
- Fetch current conditions and daily forecast for user's location.
- Store API key in local .env (user provides their own key).
- Handle API failure with cached last-known weather or skip.

### Notes
Part of FR-03.

---

### SP: 3 | Implement News API Integration

### User Story
As a user, I want Anchorpoint to include top news headlines in my morning report, so that I stay informed without opening a browser.

### Requirements
- Integrate with NewsAPI (free tier) for top headlines.
- Allow user to configure preferred news categories (tech, business, world, etc.).
- Fetch top 5-10 headlines with source and summary.
- Handle API failure gracefully.

### Notes
Part of FR-03.

---

### SP: 3 | Implement Commute Time Integration

### User Story
As a user, I want Anchorpoint to estimate my commute time in the morning report, so that I know when to leave for work.

### Requirements
- Integrate with Google Maps Directions API.
- Use home/work locations from user profile.
- Fetch estimated commute time with current traffic conditions.
- Handle API failure (return "commute data unavailable").

### Notes
Part of FR-03. Requires user to have home and work locations configured.

---

### SP: 5 | Build Morning Report Synthesis Engine

### User Story
As a user, I want Anchorpoint to combine all my morning data into a single, readable briefing written by the LLM, so that I get a cohesive start to my day instead of raw data dumps.

### Requirements
- MorningReportService aggregates data from all four APIs.
- Build prompt template that provides all data and instructs LLM to write a natural briefing.
- Handle partial data (if one API failed, note it in the report).
- Display report in a dedicated Morning Report view in the chat.
- Allow user to manually trigger a report at any time.

### Notes
UC-02 in SRS. NFR-02 says full generation must complete within 15 seconds.

---

### SP: 3 | Add Morning Report Scheduling

### User Story
As a user, I want to set a daily time for my morning report to auto-generate, so that it's ready when I wake up.

### Requirements
- Settings > Morning Report: time picker for scheduled generation.
- Background scheduler that triggers report at the configured time.
- Notification/badge when a new report is ready.
- Option to disable auto-scheduling (manual trigger only).

### Notes
Users might want it at 6 AM or 9 AM depending on their schedule.

---

## Epic 7: Deep Research

---

### SP: 5 | Implement Web Search Integration

### User Story
As a user, I want Anchorpoint to search the web when I ask research questions, so that I get answers backed by current information instead of just the model's training data.

### Requirements
- Integrate a web search API (SearXNG self-hosted or Brave Search API).
- WebSearchAPI class: search(query) returns list of results (title, URL, snippet).
- Parse and clean web page content from top results.
- Handle search failures and rate limits.
- Settings toggle to enable/disable web search.

### Notes
FR-12. SearXNG can run locally for maximum privacy; Brave Search API is an alternative.

---

### SP: 5 | Build Research Agent with Citation Generation

### User Story
As a user, I want to ask complex research questions and get summarized answers with citations, so that I can trust and verify the information Anchorpoint provides.

### Requirements
- ResearchAgent.conductResearch() orchestrates the full flow.
- Formulate 1-3 search queries from user's research question.
- Retrieve and parse top sources for each query.
- Pass retrieved content to LLM with research synthesis prompt.
- Generate inline citations linking claims to source URLs.
- Display response with clickable citation links.

### Notes
UC-01 and FR-04 in SRS. This is a multi-step agentic workflow — the key differentiator.

---

### SP: 3 | Add Research Source Panel

### User Story
As a user, I want to see all the sources Anchorpoint used for a research answer in a side panel, so that I can review the original content and verify claims.

### Requirements
- Side panel or expandable section showing sources for a research response.
- Each source: title, URL, snippet used, and relevance score.
- Click source to open in default browser.
- Sources saved with the message in conversation history.

### Notes
Builds trust and transparency. Complements FR-10 (tool transparency).

---

## Epic 8: Voice Output

---

### SP: 5 | Integrate TTS Engine with Default Voice Profiles

### User Story
As a user, I want Anchorpoint to read responses aloud using natural-sounding voices, so that I can listen instead of reading.

### Requirements
- Integrate Coqui TTS or Piper as the local TTS engine.
- Include at least 3 default voice profiles (e.g., neutral, warm, professional).
- VoiceService.speak(text) generates audio and plays it.
- Add a "Read Aloud" button on each assistant message.
- Audio playback controls (play, pause, stop).

### Notes
FR-05 and UC-04. TTS must run locally — no cloud TTS services.

---

### SP: 3 | Build Voice Configuration UI

### User Story
As a user, I want to select voice profiles and adjust speed and pitch, so that Anchorpoint sounds the way I prefer.

### Requirements
- Settings > Voice page with profile selector.
- Speed slider (0.5x to 2.0x).
- Pitch slider (adjustable range).
- Preview button to hear a sample before confirming.
- Save preference to user_profile.

### Notes
UC-04 continued.

---

### SP: 5 | Enable Custom Voice Profile Creation

### User Story
As a user, I want to create and save my own voice profiles with custom parameters, so that Anchorpoint speaks in a style unique to me.

### Requirements
- "Create New Profile" option in voice settings.
- Adjustable parameters: pitch, speed, tone warmth, emphasis.
- Name and save custom profiles.
- Custom profiles appear alongside defaults in the profile selector.
- Store custom profiles in voice_profiles table.

### Notes
FR-11. This is a stretch feature — lower priority than default voices working well.

---

## Epic 9: Tool Transparency & Logging

---

### SP: 3 | Implement Tool Invocation Logging

### User Story
As a user, I want to see a log of every tool Anchorpoint uses (API calls, searches, memory lookups), so that I understand exactly what the system is doing with my data.

### Requirements
- Log every tool call: tool name, timestamp, input parameters, success/failure status.
- Store logs in a tool_logs ChromaDB collection.
- Exclude any PII from logged parameters (sanitize before logging).
- Logs are append-only during a session.

### Notes
FR-10. Core privacy feature — users need to trust the system.

---

### SP: 3 | Build Activity Log UI

### User Story
As a user, I want to view the tool activity log in a dedicated panel, so that I can verify no personal data is being sent externally.

### Requirements
- Activity Log view accessible from sidebar or settings.
- Chronological list of tool invocations with expandable details.
- Filter by tool type (search, calendar, weather, memory, etc.).
- Filter by date range.
- Clear logs option.

### Notes
FR-10 continued. This directly supports the privacy verification NFR (NFR-06).

---

## Epic 10: Graceful Degradation & Error Handling

---

### SP: 5 | Implement Graceful Failure Handling Across All Tools

### User Story
As a user, I want Anchorpoint to continue working even when individual tools fail, so that a single API outage doesn't break my entire experience.

### Requirements
- Each tool integration wrapped in try/catch with specific error handling.
- On tool failure: log the error, return a structured partial result with explanation.
- LLM receives failure context so it can acknowledge missing data in its response.
- No unhandled exceptions should reach the user — all errors caught and explained.
- Implement retry logic with exponential backoff for transient failures (network timeouts).

### Notes
FR-06 and NFR-03. Gavin to lead testing. Test by simulating: WiFi off, API key invalid, Ollama not running, ChromaDB corrupted.

---

### SP: 3 | Build Error State UI Components

### User Story
As a user, I want clear, helpful error messages when something goes wrong, so that I understand what happened and what I can do about it.

### Requirements
- Toast notifications for non-blocking errors (e.g., "Weather data unavailable").
- Full-screen error state for critical failures (e.g., Ollama not running).
- Critical error states include troubleshooting steps (e.g., "Start Ollama by running...").
- Degraded mode indicator in the UI when operating with partial functionality.

### Notes
Good UX during failures builds trust.

---

## Epic 11: Privacy & Security

---

### SP: 5 | Implement PII Sanitization for Outbound API Requests

### User Story
As a user, I want assurance that my personal information is never included in external API requests, so that my privacy is protected even when Anchorpoint uses the internet.

### Requirements
- Build a sanitization middleware that inspects all outbound API request payloads.
- Strip or abstract PII (names, addresses, specific personal details) from search queries.
- Log sanitized vs. original queries in the tool activity log for user verification.
- Unit tests verifying PII is removed across all API integrations.

### Notes
NFR-06 and NFR-08. This is non-trivial — "meetings near [workplace]" could leak location. Define clear rules for what gets sanitized.

---

### SP: 5 | Implement Local Data Encryption at Rest

### User Story
As a user, I want my locally stored data encrypted, so that even if someone accesses my files, my conversations and personal data are protected.

### Requirements
- Encrypt ChromaDB storage directory using AES-256.
- Key derivation from user-set password or system keychain.
- Handle decryption on app launch transparently.
- Data export/import respects encryption.

### Notes
NFR-07. Important for user trust but can be deferred to a later sprint if time is tight.

---

## Epic 12: Testing & Quality Assurance

---

### SP: 5 | Set Up Testing Framework and Write Core Unit Tests

### User Story
As a developer, I want a testing framework with unit tests for core services, so that we can catch bugs early and verify requirements are met.

### Requirements
- Set up pytest for backend, Jest for frontend.
- Write unit tests for: DataAccessLayer, LLMService, MemoryStore, MorningReportService.
- Minimum 80% code coverage for core service classes.
- Set up CI to run tests on every PR.

### Notes
Gavin to lead. Reference the verification methods from HW1 Q1.

---

### SP: 5 | Write Integration Tests for External API Interactions

### User Story
As a developer, I want integration tests that verify all external API interactions work correctly and fail gracefully, so that we can be confident in the system's reliability.

### Requirements
- Integration tests for: Ollama API, Calendar API, Weather API, News API, Maps API.
- Tests for failure scenarios: network down, invalid API key, rate limited, timeout.
- Verify graceful degradation behavior for each failure case.
- Test PII sanitization on all outbound requests.

### Notes
Gavin to lead. These map directly to our reliability NFRs. Cut WiFi during tests as described in HW1.

---

### SP: 3 | Conduct Usability Testing with New Users

### User Story
As a product owner, I want feedback from new users testing Anchorpoint, so that we can identify UX problems before the final demo.

### Requirements
- Recruit 2-3 users unfamiliar with the project.
- Prepare task list: install, set up profile, send a chat, generate morning report, do a research query.
- Record completion rates, time on task, and user comments.
- Document findings and create fix stories for identified issues.

### Notes
From HW1 usability verification: "have new users try it and give us feedback to see if they can navigate our platform."

---

## Epic 13: Performance Optimization

---

### SP: 5 | Optimize LLM Context Window Management

### User Story
As a user, I want fast responses even in long conversations, so that the system doesn't slow down as context grows.

### Requirements
- Implement smart context truncation: keep system prompt + recent messages + relevant memory.
- Dynamic context budget: allocate tokens between conversation history and memory context.
- Benchmark TTFT at various context sizes (1K, 4K, 8K, 16K tokens).
- Ensure TTFT stays under 3 seconds on 8GB RAM hardware.

### Notes
NFR-01. Test with the specific models we support. Context management directly impacts perceived speed.

---

### SP: 3 | Implement Model Recommendation Based on Hardware

### User Story
As a user, I want Anchorpoint to recommend the best model for my hardware, so that I don't have to figure out which models my machine can handle.

### Requirements
- Detect available RAM, VRAM (if GPU present), and OS on launch.
- Map hardware specs to compatible models with expected performance.
- Display recommendation during onboarding and in model settings.
- Warn if user selects a model that may exceed their hardware capabilities.

### Notes
Addresses the hardware variability challenge. Helps onboarding significantly.

---

## Summary

| Epic | Stories | Total SP |
|------|---------|----------|
| 1. Project Setup & Infrastructure | 5 | 19 |
| 2. Core Chat Interface | 4 | 19 |
| 3. Model Management | 2 | 8 |
| 4. Contextual Memory | 3 | 13 |
| 5. Private Personalization | 2 | 6 |
| 6. Morning Report | 5 | 19 |
| 7. Deep Research | 3 | 13 |
| 8. Voice Output | 3 | 13 |
| 9. Tool Transparency & Logging | 2 | 6 |
| 10. Graceful Degradation | 2 | 8 |
| 11. Privacy & Security | 2 | 10 |
| 12. Testing & QA | 3 | 13 |
| 13. Performance Optimization | 2 | 8 |
| **Total** | **38** | **155** |

With 64 SP per sprint, this backlog represents roughly 2.5 sprints of work.
