# RecallAI Verification & Test Checklist

> **Honest Reporting Standard**: Every item is marked strictly as `[RUN - PASS]`, `[RUN - FAIL]`, `[MANUAL - PASS]`, or `[NOT RUN]`. No item is marked passed unless verified.

---

## 1. Database & Persistence Tests
- [x] **[RUN - PASS]** FalkorDB container startup with custom password (`FALKORDB_PASSWORD`) and AOF persistence enabled.
- [x] **[RUN - PASS]** Verification of real container data directory via `CONFIG GET dir` (`/var/lib/falkordb/data`).
- [x] **[RUN - PASS]** Basic write query via `g.query()` and read query via `g.ro_query()`.
- [x] **[RUN - PASS]** **Persistence Test 3**: Database container restart with volume kept (`docker compose restart falkordb`) — node survived.
- [x] **[RUN - PASS]** **Persistence Test 4**: Docker compose teardown without volume wipe (`docker compose down` then `up -d`) — node survived.
- [ ] **[NOT RUN]** **Persistence Test 1**: New session retrieves existing user memories across sessions (Phase 4).
- [ ] **[NOT RUN]** **Persistence Test 2**: Backend process restart preserves user memories in FalkorDB (Phase 5).

---

## 2. API Contract & Core Endpoints
- [x] **[RUN - PASS]** `GET /health` returns 200 OK with `database: "connected"` when FalkorDB is running.
- [x] **[RUN - PASS]** `GET /health` returns 503 Service Unavailable when FalkorDB is stopped / mocked disconnected.
- [x] **[RUN - PASS]** `GET /health` does not call paid LLM endpoints.
- [x] **[RUN - PASS]** CORS preflight and headers correctly allow Vite origins (`http://localhost:5173` & `http://127.0.0.1:5173`) and reject disallowed origins.
- [ ] **[NOT RUN]** `POST /chat` input validation (rejects invalid `user_id`, empty message, >4000 characters).
- [x] **[RUN - PASS]** `GET /memories` returns memories for specified `user_id` and validates format (422 on invalid).

---

## 3. Extraction & Memory Integrity
- [ ] **[NOT RUN]** Facts vs Questions: Questions ("What is recursion?") never saved as struggles (Phase 3).
- [x] **[RUN - PASS]** Negation & Correction: "I no longer struggle with X" marks previous memory resolved, not deleted.
- [x] **[RUN - PASS]** Deduplication: Repeated identical statements update/deduplicate rather than creating duplicate nodes.
- [ ] **[NOT RUN]** Exact source text: `source_text` matches user input substring (Phase 3).
- [ ] **[NOT RUN]** Schema validation: Extraction output strictly validates against Pydantic schema with at most one repair attempt (Phase 3).

---

## 4. Graph Retrieval & Education Reasoning
- [ ] **[NOT RUN]** Direct concept match: Topic in message retrieves corresponding active memory (Phase 4).
- [ ] **[NOT RUN]** Prerequisite traversal: 2-hop prerequisite traversal (`-[:REQUIRES]->`) pulls foundational concepts (Phase 4).
- [ ] **[NOT RUN]** Pedagogical preference: Active `PREFERS` memories are included in context (Phase 4).
- [ ] **[NOT RUN]** Irrelevant questions: Questions unrelated to user memory retrieve nothing (Phase 4).
- [ ] **[NOT RUN]** Resolved memories excluded: Resolved memories are excluded from retrieval context (Phase 4).
- [x] **[RUN - PASS]** User isolation: User B's queries never retrieve User A's memories or concepts.

---

## 5. Resilience & Error Handling
- [ ] **[NOT RUN]** Database failure during chat returns structured error or graceful degraded response.
- [ ] **[NOT RUN]** LLM failure after successful memory write returns HTTP 200 with saved memories and a stage warning.
- [ ] **[NOT RUN]** Prompt injection attempt inside `source_text` is treated as data, not instruction.
- [ ] **[NOT RUN]** Supabase logging disabled by default; failure never impacts chat turn.
