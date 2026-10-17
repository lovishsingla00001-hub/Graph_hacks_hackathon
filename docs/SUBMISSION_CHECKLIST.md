# RecallAI — Official Hackathon Submission Checklist

**Hackathon**: [Graph Hacks: Context for AI Agents](https://www.wemakedevs.org/hackathons/falkordb)  
**Organizers**: WeMakeDevs & FalkorDB  
**Event Window**: October 15, 12:01 AM IST – October 18, 11:59 PM IST, 2026  
**Project Name**: RecallAI  
**Target Track**: **Agent Memory and Coordination** (Track 2)  

---

## 👥 Team

- [My name] - frontend and demo
- [Partner name] - backend

**Demo video**: [VIDEO_LINK]

---

## 📋 Deliverables Matrix (Official Rule 10 & Core Requirements)

Every official requirement from the [Official Hackathon Rules](https://www.wemakedevs.org/hackathons/falkordb/rules) is mapped below to the exact file, URL, or code artifact that satisfies it.

| # | Official Requirement | Satisfying File / URL | Status | Details & Notes |
| :-: | :--- | :--- | :--- | :--- |
| **1** | **Target Track Named** | [README.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/README.md), [docs/ARCHITECTURE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/ARCHITECTURE.md) | **`[DONE]`** | Officially entered under **Track 2: Agent Memory and Coordination**. Focuses on persistent, explainable graph memory across student sessions. |
| **2** | **Public Source-Code Repository** | [GitHub Repository](https://github.com/lovishsingla00001-hub/Graph_hacks_hackathon) | **`[DONE]`** | Publicly accessible GitHub repository with clear commit history starting within the hackathon window. |
| **3** | **FalkorDB as Primary Graph Database** | [docker-compose.yml](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docker-compose.yml), [backend/app/database.py](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/backend/app/database.py) | **`[DONE]`** | FalkorDB is the sole primary database for agent memory with volume persistence. Zero secondary vector databases are used. |
| **4** | **Graph Performs Essential Work** | [backend/app/services/retrieval.py](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/backend/app/services/retrieval.py), [backend/app/services/memory_store.py](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/backend/app/services/memory_store.py) | **`[DONE]`** | FalkorDB performs 2-hop prerequisite traversals (`Concept -[:REQUIRES*1..2]-> Concept`). If FalkorDB is removed, pedagogical reasoning and memory continuity completely stop working. |
| **5** | **Graph Data Model Specification** | [README.md # Graph Data Model](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/README.md#%EF%B8%8F-graph-data-model), [docs/ARCHITECTURE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/ARCHITECTURE.md) | **`[DONE]`** | Comprehensive node tables (`:User`, `:Memory`, `:Concept`), edge tables (`:HAS_MEMORY`, `:ABOUT`, `:REQUIRES`), and visual sequence diagrams. |
| **6** | **Cypher Queries & Graph Logic** | [docs/QUERIES.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/QUERIES.md), [backend/app/queries.py](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/backend/app/queries.py) | **`[DONE]`** | 15 parameterized Cypher templates with query purpose, parameter contracts, runtime complexity, and injection prevention details. |
| **7** | **Complete Local Setup Instructions** | [README.md # Local Setup Guide](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/README.md#-local-setup-guide) | **`[DONE]`** | Step-by-step local guide: Docker container startup, Python virtual environment, FastAPI backend, and React/Vite frontend. |
| **8** | **Interactive Demo Script & Walkthrough** | [README.md # Run the Demo](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/README.md#-run-the-demo), [docs/DEMO_SCRIPT.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/DEMO_SCRIPT.md) | **`[DONE]`** | Verbatim 5-turn demo script demonstrating struggles, 2-hop prerequisite retrieval, memory resolution, session continuity, and user isolation. |
| **9** | **AI-Use Disclosure** | [AI_USE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/AI_USE.md) | **`[DONE]`** | Complete disclosure of AI tools (Antigravity IDE, Google Gemini 3.5 Flash Lite configured via `LLM_MODEL`), scope of AI-assisted vs human design, and human verification rigor. |
| **10** | **Demo Video of Working Project** | Video Link: **[VIDEO_LINK]** | **`[READY]`** | Complete interactive demo script in [docs/DEMO_SCRIPT.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/DEMO_SCRIPT.md). Video shows full flow end-to-end. |

---

## 🧠 How It Works

RecallAI executes a 5-stage loop on every student turn:
1. **Extract**: Structured extraction with guardrails extracts explicit learner facts (`STRUGGLES_WITH`, `PREFERS`, `LEARNS`, `GOAL`), verbatim quotes, and resolutions.
2. **Save to FalkorDB**: Persists or updates `:Memory` nodes in the student's isolated graph (`recallai_<user_id>`) and creates direct edges to curriculum `:Concept` nodes.
3. **Retrieve (2 hops)**: Traverses 1 to 2 prerequisite hops in FalkorDB (`(c:Concept)-[:REQUIRES*1..2]->(p:Concept)`) to uncover foundational learning gaps.
4. **Answer**: Synthesizes a personalized educational response using retrieved memories and prerequisite concepts strictly as reference data inside structured XML tags.
5. **Show Evidence**: Returns the traversed graph path, origin labels (`"You said"` vs `"Curated"`), and memory state in the interactive "Why this answer?" drawer.

### Concrete Example
- **User Input**: *"I'm learning Python, struggle with recursion, and prefer small examples."*
- **1. Extract**: Captures struggle `recursion` (verbatim: `"struggle with recursion"`) and preference `small examples`.
- **2. Save**: Writes `Memory("recursion")` and `Memory("small examples")` attached to `Student` and linked to `Concept(recursion)`.
- **3. Retrieve**: FalkorDB executes 2-hop prerequisite traversal:
  $$\text{Concept(recursion)} \xrightarrow{\text{REQUIRES}} \text{Concept(functions)} \xrightarrow{\text{REQUIRES}} \text{Concept(variables)}$$
- **4. Answer**: RecallAI grounds recursion in functions and variable call stacks, providing concise code snippets to honor the student's preference.
- **5. Show Evidence**: Traversal path and active memory badges appear in the "Why this answer?" drawer.

---

## 🚀 Local Execution & Setup Steps

The application runs locally on your machine in 3 clear steps:

1. **Docker for FalkorDB**:
   ```bash
   cp .env.example .env
   # Set FALKORDB_PASSWORD in .env
   docker compose up -d
   ```
2. **FastAPI Backend**:
   ```bash
   python -m venv backend/venv
   source backend/venv/bin/activate  # Or .\backend\venv\Scripts\Activate.ps1
   pip install -r backend/requirements.txt
   cp backend/.env.example backend/.env
   # Configure FALKORDB_PASSWORD, LLM_MODEL, and GEMINI_API_KEY
   uvicorn backend.app.main:app --port 8000
   ```
3. **React / Vite Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   # Open http://localhost:5173
   ```

### Free Gemini API Key & Model Configuration
- **Getting a Free API Key**: Visit [Google AI Studio](https://aistudio.google.com/), sign in with a Google account, click **"Get API key"**, and copy your key into `backend/.env` as `GEMINI_API_KEY=<key>`.
- **Setting LLM Model**: In `backend/.env`, set `LLM_MODEL=gemini-3.5-flash-lite`.
- **Free Tier Quota Notice**: Google Gemini free-tier keys have a small daily quota limit (~20 requests/day per model). The **[Demo Video: [VIDEO_LINK]]** demonstrates the full interactive flow end-to-end so judges can evaluate the complete user experience without hitting quota limits. All automated tests (`pytest backend/tests` and `npm test`) are 100% mocked and consume zero API quota.

---

## 🗄️ Supabase is Optional (Chat History Only)

- **Memory is ALWAYS in FalkorDB**: Student profile struggles, preferences, learning goals, prerequisite curriculum traversals, and mastery state resolutions live exclusively in **FalkorDB**.
- **Chat History Only**: Supabase is strictly optional and used solely for multi-turn chat message transcript storage across sessions/devices.
- **Graceful Browser Fallback**: If Supabase is omitted or offline, RecallAI automatically falls back to browser `localStorage` — the full chat UI, memory persistence, reasoning drawer, and sidebar sessions operate seamlessly without Supabase.

### Supabase Table SQL & service_role GRANTs
For reviewers wishing to enable remote session history, run this SQL in the **Supabase SQL Editor**:

```sql
-- Chat Sessions Table
CREATE TABLE IF NOT EXISTS public.chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    turn JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated ON public.chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at ASC);

-- Row Level Security (RLS)
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Grants for service_role (used by backend)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.chat_sessions TO service_role;
GRANT ALL ON TABLE public.chat_messages TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

---

## ⚠️ Limitations & Disclosures

1. **Memories Come Only from Explicit Statements**:
   - RecallAI extracts memories strictly from explicit personal statements (e.g. *"I struggle with recursion"*, *"I prefer small examples"*, *"I no longer struggle with recursion"*). Questions like *"What is recursion?"* or *"How do loops work?"* are treated as pure questions and never saved as learner difficulties.
2. **Demo User IDs are Labels, Not Authentication**:
   - In this hackathon demo, student IDs (`student_alice`, `student_bob`) are client-selected labels demonstrating multi-tenant graph isolation, **not an authenticated identity system**. There is no login, password, or auth token.
3. **Synthetic Data Only**:
   - Because there is no user authentication, **only synthetic educational demo data must be used**. Never input real personal identifying information (PII), confidential information, or real secrets into the application.
4. **Mocked Automated Tests**:
   - Our 68 backend pytest tests and 27 frontend unit tests execute with mocked LLM responses against real FalkorDB queries to ensure fast, deterministic CI testing without consuming API quota.
5. **Prompt Injection Mitigation vs Guarantee**:
   - Retrieved graph memories and in-session history are encapsulated in XML containers (`<user_stored_data>` and `<conversation_so_far>`). This is an active defense-in-depth mitigation rather than an absolute mathematical guarantee against all possible LLM jailbreak vectors.
6. **Graceful Restart Persistence**:
   - Persistence was validated across standard graceful Docker container restarts (`docker compose restart`, `docker compose down` without `-v`). Hard machine power cuts or dirty kernel panics were not stress-tested.

---

## 🔍 Rule-by-Rule Compliance Check

Comparison against the official rules at **[https://www.wemakedevs.org/hackathons/falkordb/rules](https://www.wemakedevs.org/hackathons/falkordb/rules)**:

1. **Rule 1 (Team Size & Members)**: Solo / Team up to 4 members.  
   *RecallAI Status*: Compliant. Team members:
   - [My name] - frontend and demo
   - [Partner name] - backend
2. **Rule 2 & 3 (FalkorDB as Primary Store & Real Graph Work)**:  
   *RecallAI Status*: Compliant. FalkorDB is the primary database mounted with named volume persistence (`recallai_falkordb_data`). Multi-hop prerequisite reasoning (`Concept -[:REQUIRES]-> Concept`) is central to the application.
3. **Rule 4 (Deployment & Execution Flexibility)**:  
   *RecallAI Status*: Compliant. Runs via standard Docker Compose with local FastAPI backend and Vite frontend.
4. **Rule 5 (Challenge Tracks)**:  
   *RecallAI Status*: Compliant. Specifically targeted to **Track 2: Agent Memory and Coordination**.
5. **Rule 6 (Data Permissions & Hygiene)**:  
   *RecallAI Status*: Compliant. Uses a curated, public 15-concept Python syllabus. Zero private, copyrighted, or sensitive user data is loaded.
6. **Rule 7 & 8 (Hackathon Timeline & Fresh Work)**:  
   *RecallAI Status*: Compliant. Initial commit created October 15, 2026. All development completed inside the Oct 15–18, 2026 window.
7. **Rule 9 (Open-Source Tools & Libraries)**:  
   *RecallAI Status*: Compliant. Built with standard open-source tools (FastAPI, React, FalkorDB Python client).
8. **Rule 10 (Mandatory Submission Items)**:  
   *RecallAI Status*: All deliverables complete in repo; demo video link placeholder prepared at `[VIDEO_LINK]`.
9. **Rule 11, 12, 13 (AI Disclosure & Code Understanding)**:  
   *RecallAI Status*: Fully documented in [AI_USE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/AI_USE.md), [docs/ARCHITECTURE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/ARCHITECTURE.md), and [docs/LEARNING_LOG.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/LEARNING_LOG.md). Complete test verification with 68 backend tests and 27 frontend tests.

> **Rule Difference Assessment**: No discrepancies found between RecallAI's submission assets and the official rules. Everything is aligned with the latest rules published at `https://www.wemakedevs.org/hackathons/falkordb/rules`.
