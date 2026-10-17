# RecallAI — Graph-Native Educational Memory Agent

RecallAI is an explainable AI tutoring agent with a persistent graph memory architecture powered by **FalkorDB**. Built for the hackathon **"Graph Hacks: Context for AI Agents"** (WeMakeDevs x FalkorDB, Oct 15–18 2026, **Track 2: Agent Memory and Coordination**).

Unlike naive chatbots or flat vector stores that merely retrieve semantic similarity chunks, RecallAI maps student struggles to a **curated curriculum knowledge graph** and executes **multi-hop prerequisite traversals** in FalkorDB (`recursion -> functions -> variables`) to address foundational learning gaps.

---

## 👥 Team

- Lovish Singla: Frontend, Backend, Demo.
- Arjun Singha: FalkorDB graph work, Demo.

**Demo video**: [VIDEO_LINK]

---

## 🧠 How It Works

RecallAI operates as a closed-loop 5-stage memory and tutoring pipeline:

1. **Extract**: Parses the student's message with structured guardrails to capture only explicit learning statements (`STRUGGLES_WITH`, `PREFERS`, `LEARNS`, `GOAL`), verbatim quotes, and resolutions.
2. **Save to FalkorDB**: Persists or updates `:Memory` nodes in the student's isolated graph (`recallai_<user_id>`) and creates direct edges to curriculum `:Concept` nodes.
3. **Retrieve (2 hops)**: Traverses up to 2 prerequisite hops in FalkorDB (`(c:Concept)-[:REQUIRES*1..2]->(p:Concept)`) to surface foundational concepts needed to overcome the active difficulty.
4. **Answer**: Synthesizes a personalized educational response using retrieved memories and prerequisite concepts strictly as reference data inside structured XML tags.
5. **Show Evidence**: Returns the traversed graph path, evidence origin labels (`"You said"` vs `"Curated"`), and memory state in the interactive "Why this answer?" drawer.

### Example Walkthrough
- **User says**: *"I'm learning Python, struggle with recursion, and prefer small examples."*
- **1. Extract**: Identifies struggle `recursion` (verbatim source: `"struggle with recursion"`) and preference `small examples`.
- **2. Save**: Idempotently creates `Memory("recursion")` and `Memory("small examples")` attached to `Student` and linked to `Concept(recursion)`.
- **3. Retrieve**: Queries FalkorDB for active memories and 2-hop prerequisites:
  $$\text{Concept(recursion)} \xrightarrow{\text{REQUIRES}} \text{Concept(functions)} \xrightarrow{\text{REQUIRES}} \text{Concept(variables)}$$
- **4. Answer**: RecallAI grounds its explanation of recursion in call stacks and function scope, respecting the learner's preference with concise code examples.
- **5. Show Evidence**: The "Why this answer?" drawer renders the exact Cypher path and memory badges so the student can verify how the tutor arrived at its explanation.

---

## 🏗️ Graph Data Model

RecallAI models educational memory as a directed property graph isolated on a per-student basis (`recallai_<user_id>`).

### Nodes

| Node Label | Properties | Meaning & Role | Data Source | Associated Query | Runtime Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`:User`** (shown as `Student` in UI) | `id`, `name`, `created_at` | Root entity representing the student learner profile. | System on first access. | `MERGE_USER_NODE` | Idempotently merged on student's first turn; anchors all personal memories. |
| **`:Memory`** | `id`, `kind`, `value`, `canonical_value`, `source_text`, `session_id`, `status`, `origin`, `dedupe_key`, `created_at` | Specific extracted learner fact: `LEARNS`, `STRUGGLES_WITH`, `PREFERS`, or `GOAL`. | LLM extraction from verbatim student messages. | `MERGE_MEMORY_NODE` | Merged using deterministic key `sha256(kind:canonical_topic)`. Marked `active` on creation; transitions to `resolved` upon mastery. |
| **`:Concept`** | `id`, `name`, `canonical_name` | Educational curriculum topic (e.g. `recursion`, `functions`, `generators`). | Curated 15-concept Python syllabus. | `SEED_CONCEPT_NODE` | Idempotently seeded into user's graph on initialization; static curriculum reference. |

### Edges

| Edge Type | Traversal Direction | Meaning & Semantics | Evidence Origin | Associated Query | Runtime Behavior |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`:HAS_MEMORY`** | `(u:User)-[:HAS_MEMORY]->(m:Memory)` | Establishes ownership: this student explicitly expressed this memory. | `"You said"` | `LINK_USER_MEMORY` | Created when saving a new memory. Direct edge from student root. |
| **`:ABOUT`** | `(m:Memory)-[:ABOUT]->(c:Concept)` | Connects a student struggle or topic to a curriculum concept node. | `"You said"` | `LINK_MEMORY_CONCEPT` | Enables graph traversals from personal difficulties into the curriculum hierarchy. |
| **`:REQUIRES`** | `(c1:Concept)-[:REQUIRES]->(c2:Concept)` | Foundational prerequisite dependency: concept `c1` requires mastery of `c2`. | `"Curated"` | `SEED_PREREQUISITE_EDGE` | Traversed 1 to 2 hops deep during retrieval to surface prerequisite learning gaps. |

---

## 🚀 Local Setup Guide

RecallAI runs entirely locally on your machine in three straightforward steps:
1. **Docker for FalkorDB** (primary graph database)
2. **FastAPI Backend** (Python 3.14)
3. **React / Vite Frontend** (Node.js 18+)

> [!NOTE]
> **Free-Tier Gemini API Notice**: Google Gemini free-tier keys have a small daily quota limit (~20 requests/day per model). Setting `LLM_MODEL=gemini-3.5-flash-lite` in `backend/.env` uses Google's lightweight flash tier. Our **[Demo Video: [VIDEO_LINK]]** showcases the full interactive user flow end-to-end. Furthermore, our automated test suite runs 100% mocked and consumes zero API quota.

### 1. Prerequisites
- **Docker & Docker Compose** (v20+ / Compose v2+)
- **Python 3.14** (tested: Python 3.14.3)
- **Node.js 18+** & npm

### 2. Start FalkorDB (Primary Graph Database)
Generate a strong database password:
```bash
# In the repository root:
cp .env.example .env

# Set your generated password in .env:
# FALKORDB_PASSWORD=<your_generated_password>
# Note: docker-compose requires FALKORDB_PASSWORD and will error if unset.

# Launch the FalkorDB container with persistent volume
docker compose up -d
```
Verify the container is running:
```bash
docker ps
```
FalkorDB runs on `127.0.0.1:6379`. The internal container data directory `/var/lib/falkordb/data` is mounted to the named volume `recallai_falkordb_data`. FalkorDB Browser is available at `http://localhost:3000`.

### 3. Backend Setup & Gemini API Key
```bash
# In the repository root:
python -m venv backend/venv

# Activate the virtual environment:
# Windows (PowerShell):
.\backend\venv\Scripts\Activate.ps1
# Linux / macOS:
source backend/venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Create backend .env configuration
cp backend/.env.example backend/.env
```

#### How to get a free Gemini API key:
1. Visit Google AI Studio at [https://aistudio.google.com/](https://aistudio.google.com/).
2. Sign in with any Google account.
3. Click **"Get API key"** -> **"Create API key"**.
4. Copy the generated API key.

#### Configure `backend/.env`:
Open `backend/.env` and verify your configuration:
```bash
FALKORDB_HOST=127.0.0.1
FALKORDB_PORT=6379
FALKORDB_PASSWORD=<same_password_as_root_.env>

LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash-lite
GEMINI_API_KEY=<your_gemini_api_key_from_google_ai_studio>
```

Start the FastAPI server:
```bash
uvicorn backend.app.main:app --reload --port 8000
```
Verify backend health:
```bash
curl http://127.0.0.1:8000/health
# Returns: {"status":"ok","database":"connected","llm_configured":true,"supabase":"not_configured"}
```

### 4. Frontend Setup & Startup
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
Open your browser at `http://localhost:5173`.
- Set **User ID**: `student_alice`
- The top-right connection badge will display **"Backend: Connected"** and **"API Mode: Live"**.

---

## 🗄️ Optional Supabase Setup (Chat History Only)

> [!IMPORTANT]
> **Supabase is strictly optional.**
> - **Educational Memory is ALWAYS in FalkorDB**: All student struggles, preferences, learning goals, curriculum prerequisites, and mastery resolutions live exclusively in **FalkorDB**.
> - **Chat History Only**: Supabase is only used for multi-session chat message transcript persistence across reloads/devices.
> - **Automatic Browser Fallback**: If Supabase is not configured (or offline), RecallAI automatically falls back to browser `localStorage`. The application, sidebar sessions, drawer, and memory graphs remain 100% functional without Supabase!

If you want persistent remote session history, create a project at [supabase.com](https://supabase.com) and run this SQL in the **Supabase SQL Editor**:

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

-- Grants for service_role (used by backend with SUPABASE_SECRET_KEY)
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE public.chat_sessions TO service_role;
GRANT ALL ON TABLE public.chat_messages TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

To enable it, set these variables in `backend/.env`:
```bash
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SECRET_KEY=your_supabase_service_role_secret_key
```

---

## 🎮 Run the Demo

Follow these exact interactive steps in the web app (`http://localhost:5173`) to observe RecallAI's graph-native memory, prerequisite traversals, and multi-session continuity:

### Turn 1: Express Struggles & Pedagogical Preferences
- **User ID**: `student_alice`
- **Type message**:
  ```text
  I'm learning Python, struggle with recursion, and prefer small examples.
  ```
- **What to observe**:
  - **Inline Memory Badge**: An inline badge appears beneath the assistant reply: `Remembered: recursion`.
  - **Graph Evidence Drawer**: Click **"Why this answer?"** on the assistant message (or **"Graph Evidence"** in the header) to open the slide-out drawer showing:
    - Real FalkorDB graph paths (`Student -> Memory -> Concept`).
    - The **"Saved memories"** tab listing Alice's active preferences and struggles with active count badge.
  - **Left Sidebar**: The conversation is automatically titled and saved under **"Today"**.

### Turn 2: Prerequisite Graph Traversal in Action
- **Type message**:
  ```text
  Can you explain how recursion works?
  ```
- **What to observe**:
  - **Assistant Response**: Rendered in clean Markdown via `react-markdown` with code highlighting and a copy-to-clipboard button.
  - **Evidence Drawer**: Click **"Why this answer?"** to inspect the 2-hop prerequisite traversal:
    $$\text{Concept(recursion)} \xrightarrow{\text{REQUIRES}} \text{Concept(functions)} \xrightarrow{\text{REQUIRES}} \text{Concept(variables)}$$
    Origin labels: `ABOUT` labeled as **"You said"**, `REQUIRES` labeled as **"Curated"**.
  - **Tutor Response**: Teaches prerequisites first (base cases, call stack) and honors the preference by providing concise code snippets.

### Turn 3: Memory Correction & Dynamic Resolution
- **Type message**:
  ```text
  I no longer struggle with recursion, but generators confuse me.
  ```
- **What to observe**:
  - **Inline Memory Badge**: Shows `Updated: recursion resolved`.
  - **Evidence Drawer ("Saved memories" tab)**:
    - `recursion` node transitions to strikethrough with a **`RESOLVED`** badge.
    - A new active struggle node for `generators` is created.

### Turn 4: Multi-Session Memory Continuity & Chat History
- **Action**:
  1. Click **"+ New chat"** at the top of the sidebar.
  2. Notice the empty-state screen with a Cormorant Garamond serif greeting (`"Hey there, Alice"`), centered composer, and 3 suggestion chips.
  3. Send message:
     ```text
     How should I write my first generator?
     ```
- **What to observe**:
  - Even in a fresh session, RecallAI recalls Alice's persistent struggle (`generators`) and preference (`small examples`) from FalkorDB, and retrieves prerequisite concepts (`functions`, `loops`).
  - Click on the previous chat under **"Today"** in the sidebar: the complete previous thread is restored with Markdown formatting and turn evidence.
  - Hover over a chat in the sidebar to **Rename** (`✎`) or **Delete** (`✕`) with confirmation dialogs. Press `Ctrl+K` to search chats.

### Turn 5: Strict Multi-Tenant User Isolation
- **Action**: Change **Demo Student Graph** at the bottom of the sidebar to `student_bob`.
- **What to observe**:
  - The Graph Evidence drawer immediately displays **"No memories stored in FalkorDB for student_bob yet"**.
  - Student Alice's graph (`recallai_student_alice`) and chat history are strictly isolated from Bob's graph (`recallai_student_bob`), ensuring zero cross-student data leakage.

---

## 🧪 Running Automated Tests

RecallAI includes a comprehensive, 100% mocked automated test suite that runs against real FalkorDB without making external LLM calls or consuming API quota:

```bash
# Run all 68 backend tests (pytest)
pytest backend/tests -v

# Run all 27 frontend contract & regression tests (Node.js test runner)
cd frontend
npm test

# Build frontend production bundle
npm run build
```

---

## ⚠️ Limitations & Honest Disclosures

1. **Memories Come Only from Explicit Statements**:
   - RecallAI enforces strict pedagogical extraction guardrails: pure questions (e.g., *"What is recursion?"*, *"Can you explain decorators?"*) are never stored as struggles or facts. Only explicit personal declarations (e.g., *"I'm struggling with recursion"*, *"I prefer code examples"*, *"I no longer struggle with recursion"*) create or update memory nodes.
2. **Demo User IDs are Labels, Not Authentication**:
   - In this hackathon demonstration, user IDs (`student_alice`, `student_bob`) are client-selected labels provided to demonstrate graph isolation, **not an authenticated identity system**. There are no passwords or user logins.
3. **Synthetic Data Only**:
   - Because there is no authentication or access control layer, **only synthetic educational demo data should be entered**. Never input real personal identifying information (PII), sensitive data, or real secrets into the application.
4. **Scripted Model Outputs in Automated Tests**:
   - The evaluation scenarios in `backend/tests/` execute against real FalkorDB queries and traversals, but use scripted (mocked) model outputs for the extraction and generation stages. This guarantees deterministic, lightning-fast regression testing (68 backend tests and 27 frontend tests) without consuming free-tier Gemini API quota. Real-model browser interactions should be verified interactively.
5. **Prompt Injection Mitigation vs Guarantee**:
   - RecallAI wraps all retrieved student profile memories inside structured `<user_stored_data>` XML containers and in-session conversation history inside `<conversation_so_far>` containers, commanding the tutor model to treat both strictly as factual data/context. While this defends against standard instruction-hijacking and jailbreak attempts, prompt injection defense in Large Language Models is an active defense-in-depth mitigation, not a formal mathematical guarantee against all novel jailbreak vectors.
6. **Scope of Persistence Verification**:
   - Persistence was empirically tested for **graceful restart cycles only**:
     - Fast process teardown & restarts of the backend.
     - Graceful container restarts (`docker compose restart falkordb`).
     - Recreating containers while keeping volumes (`docker compose down` without `-v` followed by `docker compose up -d`).
   - Hard kernel panics, abrupt machine power-cuts, or dirty ungraceful process terminations were not stress-tested.
7. **Single-User Graph Boundary**:
   - Isolation is enforced at the graph namespace boundary (`recallai_<user_id>`). Inter-student collaborative memory or classroom-level aggregation is outside the scope of this hackathon submission.
8. **Free-Tier Gemini API Quota Constraints**:
   - The free-tier Google Gemini API quota is strictly limited (approximately 20 requests per day on free-tier keys). A complete interactive demo run across 4–5 turns consumes approximately 8 API calls (extraction + generation per turn). As a result, repeated live interactive demo sessions can quickly exhaust daily free-tier quota. The demo video (`[VIDEO_LINK]`) shows the full interactive user flow. For unlimited continuous and regression testing, our automated test suite (`pytest backend/tests` and `npm test`) is 100% mocked and consumes zero API quota.

---

## 📚 Project Documentation

- [docs/SUBMISSION_CHECKLIST.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/SUBMISSION_CHECKLIST.md): Official WeMakeDevs x FalkorDB submission checklist mapping all requirements.
- [docs/ARCHITECTURE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/ARCHITECTURE.md): Complete system architecture, 5-stage pipeline, and sequence diagrams.
- [docs/QUERIES.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/QUERIES.md): Full reference of all 15 parameterized Cypher queries.
- [docs/DEMO_SCRIPT.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/DEMO_SCRIPT.md): Step-by-step evaluation script for judges.
- [docs/TEST_CHECKLIST.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/TEST_CHECKLIST.md): Honest test status checklist with pass/fail indicators.
- [AI_USE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/AI_USE.md): Complete disclosure of AI tools and pair-programming usage.
