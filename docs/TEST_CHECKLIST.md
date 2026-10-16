# RecallAI Verification & Test Checklist

> **Honest Reporting Standard**: Every item is marked strictly as `[RUN - PASS]`, `[RUN - FAIL]`, `[MANUAL - PASS]`, or `[NOT RUN]`. No item is marked passed unless verified.

---

## 1. Database & Persistence Tests
- [x] **[RUN - PASS]** FalkorDB container startup with custom password (`FALKORDB_PASSWORD`) and AOF persistence enabled.
- [x] **[RUN - PASS]** Verification of real container data directory via `CONFIG GET dir` (`/var/lib/falkordb/data`).
- [x] **[RUN - PASS]** Basic write query via `g.query()` and read query via `g.ro_query()`.
- [x] **[RUN - PASS]** **Persistence Test 3**: Database container restart with volume kept (`docker compose restart falkordb`) — node survived.
- [x] **[RUN - PASS]** **Persistence Test 4**: Docker compose teardown without volume wipe (`docker compose down` then `up -d`) — node survived.
- [x] **[RUN - PASS]** **Persistence Test 1**: New session retrieves existing user memories across sessions (`backend/tests/test_e2e_sessions_flow.py` and `test_chat_persistence_across_sessions`).
- [ ] **[NOT RUN]** **Persistence Test 2**: Backend process restart preserves user memories in FalkorDB (Phase 5).

---

## 2. API Contract & Core Endpoints
- [x] **[RUN - PASS]** `GET /health` returns 200 OK with `database: "connected"` when FalkorDB is running.
- [x] **[RUN - PASS]** `GET /health` returns 503 Service Unavailable when FalkorDB is stopped / mocked disconnected.
- [x] **[RUN - PASS]** `GET /health` does not call paid LLM endpoints.
- [x] **[RUN - PASS]** CORS preflight and headers correctly allow Vite origins (`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:5174`, `http://127.0.0.1:5174`) and reject disallowed origins.
- [x] **[RUN - PASS]** `POST /chat` input validation (rejects invalid `user_id`, empty message, >4000 characters) (`backend/tests/test_chat.py::test_chat_validation_errors`).
- [x] **[RUN - PASS]** `GET /memories` returns memories for specified `user_id` and validates format (422 on invalid).

---

## 3. Extraction & Memory Integrity
- [x] **[RUN - PASS]** Facts vs Questions: Questions ("What is recursion?") never saved as struggles.
- [x] **[RUN - PASS]** Negation & Correction: "I no longer struggle with X" marks previous memory resolved, not deleted.
- [x] **[RUN - PASS]** Deduplication: Repeated identical statements update/deduplicate rather than creating duplicate nodes.
- [x] **[RUN - PASS]** Exact source text: `source_text` matches user input substring (with casing and whitespace tolerance).
- [x] **[RUN - PASS]** Schema validation: Extraction output strictly validates against Pydantic schema with at most one repair attempt.
- [x] **[RUN - PASS]** Real Gemini live extraction evaluation across 5 test scenarios (all 5 passed).
- [x] **[RUN - PASS]** First-person pronoun guardrail: non-first-person messages bypass extraction immediately without calling LLM (`backend/tests/test_extraction.py::test_no_first_person_statements_skips_llm_call`).

---

## 4. Graph Retrieval & Education Reasoning
- [x] **[RUN - PASS]** Direct concept match: Topic in message retrieves corresponding active memory (`backend/tests/test_retrieval.py`).
- [x] **[RUN - PASS]** Prerequisite traversal: 2-hop prerequisite traversal (`-[:REQUIRES]->`) pulls foundational concepts (`backend/tests/test_retrieval.py` and `backend/tests/test_e2e_sessions_flow.py`).
- [x] **[RUN - PASS]** Real continuous graph evidence paths: `Student -HAS_MEMORY-> Memory -ABOUT-> Concept -REQUIRES-> prereqs` (`backend/tests/test_retrieval.py` and `backend/tests/test_e2e_sessions_flow.py`).
- [x] **[RUN - PASS]** Answer generation prompt receives prerequisite concepts and PREFERS memories, and instructs tutor to teach prerequisites first (`backend/tests/test_chat.py::test_answer_generation_prompt_prerequisites_and_preferences`).
- [x] **[RUN - PASS]** Pedagogical preference: Active `PREFERS` memories are included in context (`backend/tests/test_retrieval.py`).
- [x] **[RUN - PASS]** Irrelevant questions: Questions unrelated to user memory retrieve nothing (`test_irrelevant_query_retrieves_nothing`).
- [x] **[RUN - PASS]** Resolved memories excluded: Resolved memories are excluded from retrieval context (`test_resolved_memories_are_excluded_from_retrieval`).
- [x] **[RUN - PASS]** User isolation: User B's queries never retrieve User A's memories or concepts (`test_user_isolation`).

---

## 5. Resilience & Error Handling
- [x] **[RUN - PASS]** Clearly labeled system error message returned when LLM model is unavailable, preserving memory write (`backend/tests/test_chat.py::test_chat_partial_success_handling`).
- [x] **[RUN - PASS]** Prompt injection attempt inside `source_text` is treated strictly as data inside `<user_stored_data>` (`test_prompt_injection_isolation_in_answer_generation`).
- [ ] **[NOT RUN]** Database failure during chat returns structured error or graceful degraded response.
- [ ] **[NOT RUN]** Supabase logging disabled by default; failure never impacts chat turn (Phase 7).
