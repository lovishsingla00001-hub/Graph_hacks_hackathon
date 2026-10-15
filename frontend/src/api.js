/**
 * RecallAI API Client
 * THE ONLY FILE IN THE FRONTEND THAT CALLS FETCH.
 * Supports "live" backend mode and a deterministic "mock" adapter with identical shapes.
 * Never silently falls back to mock when live mode encounters an error.
 */

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
export const API_MODE = (import.meta.env?.VITE_API_MODE || "mock").toLowerCase().trim();

const FETCH_TIMEOUT_MS = 30000;

// ---------------------------------------------------------------------------
// In-Memory Mock Store (Per-user state for offline development & testing)
// ---------------------------------------------------------------------------
const mockDatabase = {
  student_alice: [
    {
      id: "mem_seed_alice_01",
      kind: "PREFERS",
      value: "visual analogies and stepwise code examples",
      status: "active",
      origin: "user_stated",
      source_text: "I learn best with visual analogies and code examples",
      session_id: "sess_seed_00",
      created_at: "2026-10-15T09:00:00Z"
    }
  ],
  student_bob: []
};

// Simulated 2-hop prerequisite graph
const mockCurriculumPrereqs = {
  recursion: "functions",
  functions: "variables",
  generators: "loops",
  list_comprehensions: "lists",
  classes: "functions",
  inheritance: "classes"
};

/**
 * Normalizes backend or mock responses to guarantee strict contract safety.
 */
export function normalizeChatResponse(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid response format: payload is not an object.");
  }
  return {
    reply: typeof raw.reply === "string" ? raw.reply : "No reply generated.",
    saved_memories: Array.isArray(raw.saved_memories) ? raw.saved_memories : [],
    retrieved_memories: Array.isArray(raw.retrieved_memories) ? raw.retrieved_memories : [],
    evidence_paths: Array.isArray(raw.evidence_paths) ? raw.evidence_paths : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
    explanation: typeof raw.explanation === "string" ? raw.explanation : ""
  };
}

/**
 * Mock implementation of POST /chat
 */
async function mockChatTurn(userId, sessionId, message) {
  // Artificial slight latency to test loading UI states
  await new Promise(res => setTimeout(res, 350));

  // Special command: simulate general backend failure
  if (message.includes("/simulate-error")) {
    const error = new Error("Simulated 500 error from /simulate-error command.");
    error.status = 500;
    error.code = "SIMULATED_ERROR";
    throw error;
  }

  // Ensure user bucket exists
  if (!mockDatabase[userId]) {
    mockDatabase[userId] = [];
  }
  const userMems = mockDatabase[userId];

  // Special command: simulate memory write failure with partial success
  if (message.includes("/simulate-write-failure")) {
    return normalizeChatResponse({
      reply: "I received your message, but encountered an internal warning while persisting memory to FalkorDB.",
      saved_memories: [],
      retrieved_memories: [],
      evidence_paths: [],
      warnings: [{ stage: "memory_write", message: "Simulated memory write failure." }],
      explanation: "No memories retrieved due to simulated storage failure."
    });
  }

  const savedMemories = [];
  const lowerMsg = message.toLowerCase();

  // Correction check: "no longer struggle with <topic>"
  if (lowerMsg.includes("no longer struggle with") || lowerMsg.includes("don't struggle with")) {
    const topicMatch = lowerMsg.match(/(?:struggle with|difficulty with)\s+([a-z_-]+)/i);
    const targetTopic = topicMatch ? topicMatch[1] : "recursion";
    const existing = userMems.find(m => m.kind === "STRUGGLES_WITH" && m.value.toLowerCase().includes(targetTopic) && m.status === "active");
    if (existing) {
      existing.status = "resolved";
      savedMemories.push({
        ...existing,
        action: "resolved"
      });
    }
    return normalizeChatResponse({
      reply: `Congratulations on conquering ${targetTopic}! I have updated your learning profile and marked that struggle resolved.`,
      saved_memories: savedMemories,
      retrieved_memories: [],
      evidence_paths: [],
      warnings: [],
      explanation: `Marked previous struggle with ${targetTopic} as resolved.`
    });
  }

  // Extraction check: "struggle with <topic>" or "find <topic> hard/tricky"
  let extractedConcept = null;
  if (lowerMsg.includes("struggle") || lowerMsg.includes("tricky") || lowerMsg.includes("hard")) {
    for (const concept of Object.keys(mockCurriculumPrereqs)) {
      if (lowerMsg.includes(concept)) {
        extractedConcept = concept;
        break;
      }
    }
    if (!extractedConcept && lowerMsg.includes("recursion")) {
      extractedConcept = "recursion";
    }

    if (extractedConcept) {
      const existing = userMems.find(m => m.kind === "STRUGGLES_WITH" && m.value.toLowerCase() === extractedConcept);
      if (existing) {
        savedMemories.push({
          ...existing,
          action: "already_known"
        });
      } else {
        const newMem = {
          id: `mem_mock_${Date.now()}`,
          kind: "STRUGGLES_WITH",
          value: extractedConcept,
          status: "active",
          origin: "user_stated",
          source_text: message,
          session_id: sessionId,
          created_at: new Date().toISOString(),
          action: "created"
        };
        userMems.unshift(newMem);
        savedMemories.push(newMem);
      }
    }
  }

  // Retrieval & Evidence generation
  const retrievedMemories = userMems.filter(m => m.status === "active");
  const evidencePaths = [];
  let explanation = "";

  if (extractedConcept || lowerMsg.includes("recursion")) {
    const activeConcept = extractedConcept || "recursion";
    const prereq1 = mockCurriculumPrereqs[activeConcept] || "functions";
    const prereq2 = mockCurriculumPrereqs[prereq1] || "variables";

    evidencePaths.push({
      steps: [
        { from: userId, relation: "HAS_MEMORY", to: activeConcept, origin: "You said" },
        { from: activeConcept, relation: "REQUIRES", to: prereq1, origin: "Curated" },
        { from: prereq1, relation: "REQUIRES", to: prereq2, origin: "Curated" }
      ]
    });
    explanation = `Retrieved active struggle with '${activeConcept}' and traversed curated prerequisites '${prereq1}' and '${prereq2}'.`;
  } else if (retrievedMemories.length > 0) {
    explanation = `Retrieved ${retrievedMemories.length} general active learner preferences.`;
  } else {
    explanation = "No memories matched this query.";
  }

  return normalizeChatResponse({
    reply: `[Mock AI Tutor] I understand you are exploring ${extractedConcept || "Python"}! Because recursion relies heavily on functions and variable scope, let's step through a concrete base condition example first.`,
    saved_memories: savedMemories,
    retrieved_memories: retrievedMemories,
    evidence_paths: evidencePaths,
    warnings: [],
    explanation
  });
}

// ---------------------------------------------------------------------------
// Public Exported API Functions
// ---------------------------------------------------------------------------

/**
 * Fetch health status of backend and database.
 */
export async function getHealth() {
  if (API_MODE === "mock") {
    return {
      status: "ok",
      database: "connected",
      llm_configured: true
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      signal: controller.signal
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Health check failed with status ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch all memories for a user.
 */
export async function getMemories(userId) {
  if (!userId) {
    throw new Error("user_id is required to fetch memories.");
  }

  if (API_MODE === "mock") {
    await new Promise(res => setTimeout(res, 200));
    return {
      memories: mockDatabase[userId] ? [...mockDatabase[userId]] : []
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/memories?user_id=${encodeURIComponent(userId)}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error?.message || `Failed to fetch memories (${res.status})`);
    }
    return {
      memories: Array.isArray(data.memories) ? data.memories : []
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Send a chat turn to the agent.
 */
export async function sendChatMessage(userId, sessionId, message) {
  if (!userId || !sessionId || !message) {
    throw new Error("user_id, session_id, and message are required.");
  }

  if (API_MODE === "mock") {
    return await mockChatTurn(userId, sessionId, message);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        message: message
      }),
      signal: controller.signal
    });

    const data = await res.json();

    // Partial success handling: If HTTP 200 with warnings, it is accepted!
    if (!res.ok) {
      const errorMsg = data?.error?.message || `Chat request failed with HTTP ${res.status}`;
      const error = new Error(errorMsg);
      error.status = res.status;
      error.code = data?.error?.code || "HTTP_ERROR";
      throw error;
    }

    return normalizeChatResponse(data);
  } finally {
    clearTimeout(timeoutId);
  }
}
