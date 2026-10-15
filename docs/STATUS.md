# RecallAI Project Status

Updated: 2026-10-15 (Hackathon Event Window)

## Current Status
- **Phase**: Phase 3 Complete -> Starting Phase 4 (Graph Retrieval, /chat Pipeline, and Live Frontend Connection)
- **Branch**: `dev`

## Done
- [x] Inspected repo state and git log (clean dev branch on remote `origin/dev`).
- [x] Verified local toolchains: Node.js v24.14.1, Python 3.14.3, Docker 29.8.2 & Docker Compose v5.6.0.
- [x] Aligned on core architecture:
  - FalkorDB primary memory graph database with graph-per-user isolation (`recallai_<user_id>`).
  - Google Gemini (`gemini-3.8-flash`) as the selected LLM provider behind provider-agnostic `llm_client.py`.
  - Strict API contract established in `docs/API_CONTRACT.md`.
- [x] Created root `.gitignore` protecting env secrets, python artifacts, node_modules.
- [x] Created root `.env.example` and `backend/.env.example`.
- [x] Implemented `docker-compose.yml` with password protection, AOF persistence (`--appendonly yes --appendfsync everysec`), and 127.0.0.1 port bindings.
- [x] Determined exact FalkorDB data directory inside container via `CONFIG GET dir` (`/var/lib/falkordb/data`) and mounted named volume `recallai_falkordb_data`.
- [x] Proved database persistence across:
  - Container restart with volume kept (`docker compose restart falkordb`).
  - Container teardown and restart without `-v` (`docker compose down; docker compose up -d`).
- [x] Built backend core foundation: `config.py`, `database.py`, `schemas.py`, `queries.py`, `routes/health.py`, `main.py`.
- [x] Configured strict CORS middleware matching allowed Vite origins without wildcards.
- [x] Created test suite: verified FalkorDB read/write smoke test and executed pytest suite for health checks and CORS preflight (4/4 passed).
- [x] Phase 2: Built curated 15-concept curriculum graph (`curriculum.py`) with idempotent seeding on graph creation.
- [x] Phase 2: Implemented `MemoryStore` service with deterministic deduplication keys, memory resolution, and user isolation.
- [x] Phase 2: Implemented `GET /memories` endpoint with input validation and registered in FastAPI app.
- [x] Phase 2: Built full frontend shell with React + Vite, vanilla CSS, and offline mock adapter in `src/api.js`.
- [x] Phase 2: Executed automated tests: 10 backend pytest tests passed; 7 frontend node:test tests passed; frontend build succeeded.
- [x] Phase 3: Implemented provider-agnostic `llm_client.py` supporting Google Gemini (`gemini-3.8-flash`) and OpenAI/Groq fallback.
- [x] Phase 3: Built `extraction.py` enforcing Pydantic schemas, verbatim `source_text` substrings, question-rejection guardrails, and single-repair recovery logic.
- [x] Phase 3: Automated test suite in `test_extraction.py` (7/7 passed; total backend tests: 17/17 passed).

## In Progress
- [ ] Phase 4: Multi-hop graph prerequisite traversal retrieval, answer generation with prompt injection hygiene, `POST /chat` endpoint, and live frontend connection.

## Next
- Phase 4: Retrieval + /chat + frontend connected live.
- Phase 3: Validated extraction, deduplication, and memory correction.
- Phase 4: Prerequisite graph traversal retrieval and live chat pipeline.

## Blocked
- None currently.

## Questions / Notes for Partner
- Frontend owned by user, backend owned by partner. Shared files (`docker-compose.yml`, `docs/API_CONTRACT.md`, `README.md`) are coordinated before modification.
- Always run `git pull --rebase origin dev` prior to working and prior to push.
