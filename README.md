# RecallAI — Graph-Native Educational Memory Agent

RecallAI is an explainable AI tutoring agent with a persistent graph memory architecture powered by **FalkorDB**. Built for the hackathon **"Graph Hacks: Context for AI Agents"** (WeMakeDevs x FalkorDB, Oct 15–18 2026, **Track 2: Agent Memory and Coordination**).

Unlike naive chatbots or flat vector stores that merely retrieve semantic similarity chunks, RecallAI maps student struggles to a **curated curriculum knowledge graph** and executes **multi-hop prerequisite traversals** in FalkorDB (`recursion -> functions -> variables`) to address foundational learning gaps.

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

## 🚀 Clean-Clone Setup Guide

Follow these exact steps from a fresh clone to run the entire system locally:

### 1. Prerequisites
- **Docker & Docker Compose** (v20+ / Compose v2+)
- **Python 3.14** (tested: Python 3.14.3)
- **Node.js 18+** & npm

### 2. Start FalkorDB (Primary Graph Database)
Generate a strong database password:
```bash
# Generate a random 16-byte hex password (choose one):
openssl rand -hex 16
# or using Python:
python -c "import secrets; print(secrets.token_hex(16))"
```

```bash
# 1. Copy the root environment file
cp .env.example .env

# Set your generated password in .env:
# FALKORDB_PASSWORD=<your_generated_password>
# Note: docker-compose requires FALKORDB_PASSWORD and will error if unset.

# 2. Launch the FalkorDB container with persistent volume
docker compose up -d
```
Verify the container is running:
```bash
docker ps
```
FalkorDB runs on `127.0.0.1:6379`. The internal container data directory `/var/lib/falkordb/data` is mounted to the named volume `recallai_falkordb_data`. FalkorDB Browser is available at `http://localhost:3000`.

### 3. Backend Setup & Startup
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

# Create backend .env
cp backend/.env.example backend/.env
```

Open `backend/.env` and verify your configuration:
- `FALKORDB_PASSWORD`: Matches the `FALKORDB_PASSWORD` set in root `.env` and used by `docker-compose.yml` (required; no hard-coded default).
- `LLM_PROVIDER`: `gemini` (default)
- `LLM_MODEL`: `gemini-3.8-flash` (Google Gemini 3.8 Flash is configured as the default model; setting `LLM_MODEL` in `backend/.env` overrides it to any supported model such as `gemini-2.5-flash`, `gpt-4o-mini`, etc.)
- `GEMINI_API_KEY`: Add your Google Gemini API key here for live tutoring. (Automated tests run completely mocked without requiring an API key).

Start the FastAPI server:
```bash
uvicorn backend.app.main:app --reload --port 8000
```
Verify backend health in your browser or terminal:
```bash
curl http://127.0.0.1:8000/health
# Returns: {"status":"ok","database":"connected","llm_provider":"gemini","model":"gemini-3.8-flash"}
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

## 🎮 Run the Demo

Follow these exact interactive steps in the web app (`http://localhost:5173`) to observe RecallAI's graph-native memory, prerequisite traversals, and multi-session continuity:

### Turn 1: Express Struggles & Pedagogical Preferences
- **User ID**: `student_alice`
- **Type message**:
  ```text
  I'm learning Python, struggle with recursion, and prefer small examples.
  ```
- **What to observe**:
  - **Memory Panel (Left)**: 3 active memories appear instantly:
    - `LEARNS: python`
    - `STRUGGLES_WITH: recursion` (linked to `Concept(recursion)`)
    - `PREFERS: small examples`
  - **Evidence Inspector (Right)**: Shows real graph paths stored in FalkorDB.

### Turn 2: Prerequisite Graph Traversal in Action
- **Type message**:
  ```text
  Can you explain how recursion works?
  ```
- **What to observe**:
  - **Evidence Inspector**: FalkorDB executes a 2-hop prerequisite traversal:
    $$\text{Concept(recursion)} \xrightarrow{\text{REQUIRES}} \text{Concept(functions)} \xrightarrow{\text{REQUIRES}} \text{Concept(variables)}$$
    Origin labels: `ABOUT` labeled as **"You said"**, `REQUIRES` labeled as **"Curated"**.
  - **Tutor Response**: Teaches prerequisites first (base cases, call stack) and honors the preference by providing concise code snippets.

### Turn 3: Memory Correction & Dynamic Resolution
- **Type message**:
  ```text
  I no longer struggle with recursion, but generators confuse me.
  ```
- **What to observe**:
  - **Memory Panel**: The previous `recursion` card transitions to a dashed border with a **`RESOLVED`** badge. A new active struggle card for `generators` is created.

### Turn 4: Multi-Session Memory Continuity
- **Action**: Click the **"New Session"** button in the top header bar (clears chat history, starts new session `sess_2` for `student_alice`).
- **Type message**:
  ```text
  How should I write my first generator?
  ```
- **What to observe**:
  - Even though the chat history was cleared, RecallAI recalls Alice's persistent struggle (`generators`) and preference (`small examples`) from FalkorDB, and retrieves prerequisite concepts (`functions`, `loops`).

### Turn 5: Strict Multi-Tenant User Isolation
- **Action**: Change **User ID** in the header to `student_bob`.
- **What to observe**:
  - The memory panel immediately displays **"Active Memories (0)"**.
  - Student Alice's graph (`recallai_student_alice`) is strictly isolated from Bob's graph (`recallai_student_bob`), ensuring zero cross-student data leakage.

---

## 🧪 Running Automated Tests

RecallAI includes a comprehensive, 100% mocked automated test suite that runs against real FalkorDB without making external LLM calls or consuming API quota:

```bash
# Run all 50 backend tests (pytest)
pytest backend/tests -v

# Run frontend contract & adapter tests (Node.js test runner)
cd frontend
node --test test/api.test.mjs
```

---

## ⚠️ Honest Limitations & Disclosures

1. **Scripted Model Outputs in Automated Tests**:
   - The ~15 evaluation scenarios in `backend/tests/test_phase5_eval.py` execute against real FalkorDB queries and traversals, but use scripted (mocked) model outputs for the extraction and generation stages. This guarantees deterministic, lightning-fast regression testing (50 tests in <2.5s) without consuming free-tier Gemini API quota. Real-model browser interactions should be verified interactively.
2. **Prompt Injection Mitigation vs Guarantee**:
   - RecallAI wraps all retrieved student profile memories inside structured `<user_stored_data>` XML containers and commands the tutor model to treat stored text strictly as factual data. While this defends against standard instruction-hijacking and jailbreak attempts, prompt injection defense in Large Language Models is an active defense-in-depth mitigation, not a formal mathematical guarantee against all novel jailbreak vectors.
3. **Scope of Persistence Verification**:
   - Persistence was empirically tested for **graceful restart cycles only**:
     - Fast process teardown & restarts of the backend.
     - Graceful container restarts (`docker compose restart falkordb`).
     - Recreating containers while keeping volumes (`docker compose down` without `-v` followed by `docker compose up -d`).
   - Hard kernel panics, abrupt machine power-cuts, or dirty ungraceful process terminations were not stress-tested.
4. **Single-User Graph Boundary**:
   - Isolation is enforced at the graph namespace boundary (`recallai_<user_id>`). Inter-student collaborative memory or classroom-level aggregation is outside the scope of this hackathon submission.
5. **Free-Tier Gemini API Quota Constraints**:
   - The free-tier Google Gemini API quota is strictly limited (approximately 20 requests per day on free-tier keys). A complete interactive demo run across 4–5 turns consumes approximately 8 API calls (extraction + generation per turn). As a result, repeated live interactive demo sessions can quickly exhaust daily free-tier quota. For unlimited continuous and regression testing, our automated test suite (`pytest backend/tests -v`) is 100% mocked and consumes zero API quota.

---

## 📚 Project Documentation

- [docs/SUBMISSION_CHECKLIST.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/SUBMISSION_CHECKLIST.md): Official WeMakeDevs x FalkorDB submission checklist mapping all requirements.
- [docs/ARCHITECTURE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/ARCHITECTURE.md): Complete system architecture, 5-stage pipeline, and sequence diagrams.
- [docs/QUERIES.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/QUERIES.md): Full reference of all 15 parameterized Cypher queries.
- [docs/DEMO_SCRIPT.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/DEMO_SCRIPT.md): Step-by-step evaluation script for judges.
- [docs/TEST_CHECKLIST.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/docs/TEST_CHECKLIST.md): Honest test status checklist with pass/fail indicators.
- [AI_USE.md](file:///c:/Users/Lovish%20Laptop/Documents/Graph_hacks_hackathon/AI_USE.md): Complete disclosure of AI tools and pair-programming usage.
