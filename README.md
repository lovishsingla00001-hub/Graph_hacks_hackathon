# RecallAI — Knowledge Graph-Powered Educational Memory Agent

RecallAI is an AI tutoring assistant with a persistent, explainable graph memory architecture built on **FalkorDB**. Built for the hackathon **"Graph Hacks: Context for AI Agents"** (WeMakeDevs x FalkorDB, Oct 15-18 2026 IST, **Track 2: Agent Memory and Coordination**).

---

## 🎯 Track Focus & Memory Model
- **Episodic Memory**: User experiences, specific chat turns, and verbatim user statements stored in `Memory.source_text` linked to `session_id`.
- **Semantic Memory**: Knowledge facts and struggles connected to curriculum concepts: `(User)-[:HAS_MEMORY]->(Memory)-[:ABOUT]->(Concept)` where `Memory.kind` is `LEARNS`, `STRUGGLES_WITH`, or `GOAL`.
- **Procedural Memory**: Pedagogical preferences (`PREFERS`) indicating *how* the agent should instruct (e.g. visual analogies, code examples first).
- **Curated Prerequisite Traversal**: Educational concept map with `(:Concept)-[:REQUIRES]->(:Concept)` relationships to reason about underlying foundational gaps.

---

## 🏗️ Architecture & Versions
- **FalkorDB Image**: `falkordb/falkordb:latest` (Engine Module version `42201`, AOF persistence enabled)
- **FalkorDB Client**: `falkordb==1.8.0` (Python 3.10+)
- **Backend**: FastAPI 0.143, Pydantic 2.14, Pytest 9.1
- **LLM Provider**: Google Gemini (`gemini-3.8-flash`) behind provider-agnostic `llm_client.py`
- **Frontend**: React + Vite, plain CSS (No complex framework abstractions)

---

## 🚀 Quickstart & Setup

### 1. Start FalkorDB
```bash
# 1. Copy the environment template
cp .env.example .env

# 2. Start FalkorDB container with persistent volume
docker compose up -d
```
FalkorDB runs on `127.0.0.1:6379`. The FalkorDB Browser is available for debugging at `http://localhost:3000`.

### 2. Run Backend
```bash
# In backend directory
cd backend
python -m venv venv
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Edit .env with your FALKORDB_PASSWORD and GEMINI_API_KEY

uvicorn app.main:app --reload --port 8000
```
API Documentation is available at `http://127.0.0.1:8000/docs`.

### 3. Run Automated Tests
```bash
pytest backend/tests/test_health.py -v
```

---

## 🔒 Security & Data Hygiene
- Secrets are stored exclusively in gitignored `.env` files.
- Per-user isolated graphs: Each user has their own FalkorDB graph (`recallai_<user_id>`), guaranteeing zero data leakage across learners.
- Fixed parameterized Cypher queries: No string interpolation, preventing Cypher injection.
- No LLM-generated Cypher: All queries are deterministic templates in `backend/app/queries.py`.
