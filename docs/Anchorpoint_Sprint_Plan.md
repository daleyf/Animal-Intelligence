# Anchorpoint — Sprint Plan (4 Sprints)

**Team Capacity:** 64 SP per sprint (4 members × 8 hrs/week × 2 weeks)
**Total Backlog:** 155 SP across 38 stories
**Buffer:** ~101 SP across 4 sprints (absorbs learning curve, debugging, Scrum overhead, and scope adjustments)

---

## Sprint 1: Foundation & Core Chat
**Goal:** Get a working chat app talking to a local LLM. By the end of this sprint, a user can open Anchorpoint, select a model, and have a streamed conversation that persists.

**Sprint Backlog: 52 SP**

| SP | Story | Epic | Owner |
|----|-------|------|-------|
| 3 | Initialize Project Repository and Dev Environment | Setup | Haiden |
| 3 | Set Up Ollama Integration and Local LLM Baseline | Setup | Daley |
| 5 | Set Up Backend API Framework | Setup | Daley |
| 3 | Set Up SQLite Database and Data Access Layer | Setup | Gavin |
| 5 | Set Up Frontend Application Shell | Setup | Dante |
| 8 | Build Real-Time Chat Interface | Chat | Dante |
| 5 | Implement Chat Backend with Ollama Streaming | Chat | Daley |
| 3 | Persist Conversation History | Chat | Haiden |
| 3 | Search and Manage Conversation History | Chat | Haiden |
| 5 | Build Model Selection and Download Interface | Models | Daley |
| 3 | Implement Model Switching Without Restart | Models | Daley |
| 3 | Build User Profile Setup Flow | Personalization | Dante |
| 3 | Inject Personalization Context into LLM Prompts | Personalization | Haiden |

**Per-member load:**
- **Haiden (PM/Scrum):** 12 SP — Conversation history, personalization injection, repo setup
- **Daley (Lead Dev):** 21 SP — Ollama, backend, streaming, model management (heavy sprint, but this is his strength)
- **Dante (UX):** 16 SP — Frontend shell, chat UI, profile onboarding
- **Gavin (Test):** 3 SP — Database setup (lighter sprint; use remaining time for test framework research and manual QA)

**Sprint 1 Demo:** Live demo of chatting with a local LLM, switching models, conversation history in sidebar, and personalized greeting using profile data.

---

## Sprint 2: Intelligence Layer (Memory + Research + Morning Report APIs)
**Goal:** Make Anchorpoint smart. Add contextual memory, deep research, and wire up all external APIs for the morning report. By the end of this sprint, the assistant remembers past conversations, can search the web, and pulls live data from calendar/weather/news/commute.

**Sprint Backlog: 48 SP**

| SP | Story | Epic | Owner |
|----|-------|------|-------|
| 5 | Set Up ChromaDB Vector Store for Memory | Memory | Daley |
| 5 | Integrate Memory Retrieval into Chat Flow | Memory | Daley |
| 3 | Build Memory Management UI | Memory | Dante |
| 5 | Implement Web Search Integration | Research | Daley |
| 5 | Build Research Agent with Citation Generation | Research | Haiden |
| 3 | Add Research Source Panel | Research | Dante |
| 5 | Implement Calendar API Integration | Morning Report | Haiden |
| 3 | Implement Weather API Integration | Morning Report | Gavin |
| 3 | Implement News API Integration | Morning Report | Gavin |
| 3 | Implement Commute Time Integration | Morning Report | Gavin |
| 5 | Set Up Testing Framework and Write Core Unit Tests | Testing | Gavin |

**Per-member load:**
- **Haiden:** 10 SP — Research agent, calendar API
- **Daley:** 15 SP — ChromaDB, memory integration, web search
- **Dante:** 6 SP — Memory UI, research source panel (use remaining time to polish Sprint 1 UI based on feedback)
- **Gavin:** 14 SP — Weather/news/commute APIs, testing framework + unit tests

**Sprint 2 Demo:** Ask Anchorpoint a research question and get a cited answer. Reference something from a past conversation and see it remember. Show all four API integrations returning live data (calendar events, weather, news headlines, commute time).

---

## Sprint 3: Full Features (Morning Report + Voice + Error Handling + Transparency)
**Goal:** Ship the full feature set. Morning report synthesis works end-to-end, voice output is functional, the system handles failures gracefully, and users can see what tools are being used. This is the feature-complete sprint.

**Sprint Backlog: 40 SP**

| SP | Story | Epic | Owner |
|----|-------|------|-------|
| 5 | Build Morning Report Synthesis Engine | Morning Report | Haiden |
| 3 | Add Morning Report Scheduling | Morning Report | Haiden |
| 5 | Integrate TTS Engine with Default Voice Profiles | Voice | Daley |
| 3 | Build Voice Configuration UI | Voice | Dante |
| 5 | Implement Graceful Failure Handling Across All Tools | Degradation | Gavin |
| 3 | Build Error State UI Components | Degradation | Dante |
| 3 | Implement Tool Invocation Logging | Transparency | Daley |
| 3 | Build Activity Log UI | Transparency | Dante |
| 5 | Write Integration Tests for External API Interactions | Testing | Gavin |

**Per-member load (lighter sprint — intentional):**
- **Haiden:** 8 SP — Morning report engine + scheduling
- **Daley:** 8 SP — TTS integration, tool logging
- **Dante:** 9 SP — Voice UI, error states, activity log UI
- **Gavin:** 10 SP — Graceful failure handling, integration tests

**Why lighter:** Sprint 3 involves the most cross-cutting work (error handling touches every module, integration tests cover all APIs). The lower point count accounts for the coordination overhead and bug fixing that comes with wiring everything together.

**Sprint 3 Demo:** Full morning report read aloud with a custom voice. Simulate an API failure mid-report and show graceful degradation. Show the activity log proving no PII left the device.

---

## Sprint 4: Polish, Security, Performance & Final Demo
**Goal:** Harden the product. Encrypt data, optimize performance, run usability testing, and fix everything that surfaced in Sprints 1-3. Prepare for the final presentation.

**Sprint Backlog: 26 SP** (+ bug fixes and polish from previous sprints)

| SP | Story | Epic | Owner |
|----|-------|------|-------|
| 5 | Implement PII Sanitization for Outbound API Requests | Security | Daley |
| 5 | Implement Local Data Encryption at Rest | Security | Daley |
| 5 | Optimize LLM Context Window Management | Performance | Haiden |
| 3 | Implement Model Recommendation Based on Hardware | Performance | Haiden |
| 5 | Enable Custom Voice Profile Creation | Voice | Dante |
| 3 | Conduct Usability Testing with New Users | Testing | Gavin |

**Per-member load:**
- **Haiden:** 8 SP — Context window optimization, hardware recommendation
- **Daley:** 10 SP — PII sanitization, encryption at rest
- **Dante:** 5 SP — Custom voice profiles (+ remaining time for UI polish, fixing usability issues)
- **Gavin:** 3 SP — Usability testing (+ remaining time for regression testing, bug verification, final QA pass)

**Remaining capacity (~38 SP):** This is your buffer for:
- Bug fixes from usability testing findings
- UI polish and responsive design fixes
- Documentation (user guide, API docs)
- Final demo/presentation preparation
- Any stories that slipped from earlier sprints
- Performance benchmarking and tuning

**Sprint 4 Demo (Final):** End-to-end demo of the complete Anchorpoint experience. Full walkthrough: onboarding → morning report → chat with memory → deep research → voice output → show privacy verification through activity logs.

---

## Sprint Velocity Summary

| Sprint | Planned SP | Focus |
|--------|-----------|-------|
| Sprint 1 | 52 | Foundation + Core Chat |
| Sprint 2 | 48 | Memory + Research + APIs |
| Sprint 3 | 40 | Full Features + Error Handling |
| Sprint 4 | 26 + buffer | Security + Polish + Final QA |
| **Total** | **155 + buffer** | |

The decreasing velocity per sprint is intentional: early sprints are greenfield building (fast), later sprints involve integration, cross-module testing, and polish (slower, more coordination). The buffer in Sprint 4 is critical — every project has surprises, and having room to absorb them in the final sprint prevents a last-week crisis.

---

## Dependency Map

```
Sprint 1 (must come first)
├── Repo + Ollama + Backend + DB + Frontend  ← everything depends on these
├── Chat Interface + Streaming Backend       ← core interaction loop
├── Model Management                         ← need a working model to test anything
└── User Profile + Personalization           ← morning report needs location data

Sprint 2 (builds on Sprint 1)
├── ChromaDB + Memory                        ← needs working chat to store/retrieve
├── Web Search + Research Agent              ← needs working chat + backend
├── Calendar/Weather/News/Commute APIs       ← independent, can parallelize
└── Testing Framework                        ← needs code from Sprint 1 to test

Sprint 3 (builds on Sprint 2)
├── Morning Report Synthesis                 ← needs all 4 APIs from Sprint 2
├── TTS + Voice                              ← needs working chat output
├── Graceful Degradation                     ← needs all integrations to test failure paths
└── Tool Logging + Activity Log              ← needs all tools implemented

Sprint 4 (builds on everything)
├── PII Sanitization                         ← needs all outbound API calls in place
├── Encryption                               ← needs final DB schema stable
├── Performance Optimization                 ← needs full system running
└── Usability Testing                        ← needs feature-complete product
```
