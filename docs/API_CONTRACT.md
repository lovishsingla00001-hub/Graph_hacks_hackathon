# RecallAI API Contract (v1.0)

> **Single Source of Truth**: Any modifications to this contract require explicit discussion and user approval.

## Base URL
Default local development base URL: `http://127.0.0.1:8000`

---

## Endpoints

### 1. Health Check
- **Path**: `GET /health`
- **Description**: Verifies database connectivity and checks whether LLM credentials are configured. Does **not** invoke paid LLM calls.
- **Responses**:
  - **200 OK** (database connected):
    ```json
    {
      "status": "ok",
      "database": "connected",
      "llm_configured": true
    }
    ```
  - **503 Service Unavailable** (database down):
    ```json
    {
      "status": "degraded",
      "database": "disconnected",
      "llm_configured": true
    }
    ```

---

### 2. Chat Turn
- **Path**: `POST /chat`
- **Request Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "user_id": "student_alice",
    "session_id": "sess_20261015_01",
    "message": "I find recursion really tricky, but I know how functions work."
  }
  ```
  - `user_id`: string matching `^[a-z0-9_-]{3,40}$`
  - `session_id`: string matching `^[a-z0-9_-]{3,64}$`
  - `message`: string (1 - 4000 characters)

- **Response (200 OK)**:
  ```json
  {
    "reply": "Recursion can feel daunting at first! Since you understand functions, think of recursion as a function calling itself with a base condition...",
    "saved_memories": [
      {
        "id": "mem_rec_001",
        "kind": "STRUGGLES_WITH",
        "value": "recursion",
        "status": "active",
        "origin": "user_stated",
        "source_text": "I find recursion really tricky",
        "session_id": "sess_20261015_01",
        "created_at": "2026-10-15T10:00:00Z",
        "action": "created"
      }
    ],
    "retrieved_memories": [
      {
        "id": "mem_rec_001",
        "kind": "STRUGGLES_WITH",
        "value": "recursion",
        "status": "active",
        "origin": "user_stated",
        "source_text": "I find recursion really tricky",
        "session_id": "sess_20261015_01",
        "created_at": "2026-10-15T10:00:00Z"
      }
    ],
    "evidence_paths": [
      {
        "steps": [
          {
            "from": "student_alice",
            "relation": "HAS_MEMORY",
            "to": "recursion",
            "origin": "You said"
          },
          {
            "from": "recursion",
            "relation": "REQUIRES",
            "to": "functions",
            "origin": "Curated"
          }
        ]
      }
    ],
    "warnings": [],
    "explanation": "Retrieved 1 active memory matching concept 'recursion', traversing prerequisite prerequisite 'functions'."
  }
  ```

---

### 3. List User Memories
- **Path**: `GET /memories?user_id=student_alice`
- **Query Parameters**:
  - `user_id`: string (required)
- **Response (200 OK)**:
  ```json
  {
    "memories": [
      {
        "id": "mem_rec_001",
        "kind": "STRUGGLES_WITH",
        "value": "recursion",
        "status": "active",
        "origin": "user_stated",
        "source_text": "I find recursion really tricky",
        "session_id": "sess_20261015_01",
        "created_at": "2026-10-15T10:00:00Z"
      }
    ]
  }
  ```

---

## Error Handling Standard

- Standard non-2xx responses return:
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Invalid user_id format. Must match ^[a-z0-9_-]{3,40}$."
    }
  }
  ```
- **Partial Failure Rule**: If memories were saved to FalkorDB successfully, but downstream LLM answer generation failed, the server responds with **HTTP 200** containing the saved memories, an apology fallback reply, and a warning item `{ stage: "llm", message: "..." }`.
