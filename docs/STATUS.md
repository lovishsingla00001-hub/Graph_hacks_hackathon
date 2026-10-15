# RecallAI Project Status

Updated: 2026-10-15 (Hackathon Event Window)

## Current Status
- **Phase**: Phase 4 Complete (Graph Retrieval, /chat Pipeline, and Live Frontend Connection) -> Advancing to Phase 5
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
- [x] Phase 2: Built curated 15-concept curriculum graph (`curriculum.py`) with idempotent seeding on graph creation.
- [x] Phase 2: Implemented `MemoryStore` service with deterministic deduplication keys, memory resolution, and user isolation.
- [x] Phase 2: Implemented `GET /memories` endpoint with input validation and registered in FastAPI app.
- [x] Phase 2: Built full frontend shell with React + Vite, vanilla CSS, and offline mock adapter in `src/api.js`.
- [x] Phase 3: Implemented provider-agnostic `llm_client.py` supporting Google Gemini (`gemini-3.8-flash`) and OpenAI/Groq fallback with rate-limit retry backoff.
- [x] Phase 3: Built `extraction.py` enforcing Pydantic schemas, verbatim `source_text` substrings, question-rejection guardrails, and single-repair recovery logic.
- [x] Phase 3: Live real Gemini evaluation on 5 hackathon test scenarios (all passed, commit `40ce862`).
- [x] Phase 4: Graph Retrieval Service (`retrieval.py`): 2-hop prerequisite traversal (`-[:REQUIRES]->`), active memory ranking (direct > prereq > preferences, cap 8), real evidence steps from returned rows, and deterministic explanation formatting.
- [x] Phase 4: Answer Generation Service (`answer_generation.py`): Tutoring response with strict prompt injection hygiene (`<user_stored_data>` data isolation block).
- [x] Phase 4: Complete `POST /chat` Route (`chat.py`): Validate -> Extract -> Store/Correct in FalkorDB -> Retrieve -> Generate. Partial success guarantee (HTTP 200 with warnings if DB succeeds but LLM fails).
- [x] Phase 4: Frontend connected to live mode (`VITE_API_MODE=live` in `frontend/.env.local`).
- [x] Phase 4: Full automated test suite (30 passed in 1.04s): multi-session memory persistence, prerequisite traversal, evidence construction, input validation, prompt injection isolation.

## In Progress
- [ ] Phase 5: Persistence testing under backend restarts and demo script preparation.

## Next
- Phase 5: Persistence & Edge Case Stress Testing.
- Phase 6: Frontend Evidence Inspector Polish & Verification.
- Phase 7: Optional Supabase audit logging (write-only).

## Blocked
- None currently.

## Questions / Notes for Partner
- Always verify no secret keys are in staged git diff before pushing.
