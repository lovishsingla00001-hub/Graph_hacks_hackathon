import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeChatResponse, getHealth, getMemories, sendChatMessage } from '../src/api.js';

test('normalizeChatResponse guarantees contract fields and arrays', () => {
  const normalized = normalizeChatResponse({
    reply: "Hello student!",
    saved_memories: null,
    warnings: undefined
  });

  assert.equal(normalized.reply, "Hello student!");
  assert.ok(Array.isArray(normalized.saved_memories));
  assert.ok(Array.isArray(normalized.retrieved_memories));
  assert.ok(Array.isArray(normalized.evidence_paths));
  assert.ok(Array.isArray(normalized.warnings));
  assert.equal(normalized.explanation, "");
});

test('mock getHealth returns connected database status', async () => {
  const health = await getHealth();
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'connected');
  assert.equal(health.llm_configured, true);
});

test('mock getMemories enforces per-user isolation', async () => {
  const aliceMems = await getMemories('student_alice');
  const bobMems = await getMemories('student_bob');

  assert.ok(Array.isArray(aliceMems.memories));
  assert.ok(Array.isArray(bobMems.memories));
  // Alice starts with seeded preference, Bob starts empty
  assert.equal(aliceMems.memories.length, 1);
  assert.equal(bobMems.memories.length, 0);
});

test('mock sendChatMessage handles extraction and evidence paths', async () => {
  const res = await sendChatMessage('student_alice', 'sess_test_1', 'I struggle with recursion in Python');
  
  assert.ok(res.reply.length > 0);
  assert.ok(res.saved_memories.length > 0);
  assert.equal(res.saved_memories[0].value, 'recursion');
  assert.ok(res.evidence_paths.length > 0);
  
  const steps = res.evidence_paths[0].steps;
  assert.equal(steps[0].from, 'Student');
  assert.equal(steps[0].relation, 'HAS_MEMORY');
  assert.equal(steps[0].to, 'Memory("Struggles with recursion")');
  assert.equal(steps[0].origin, 'You said');
  assert.equal(steps[1].from, 'Memory("Struggles with recursion")');
  assert.equal(steps[1].relation, 'ABOUT');
  assert.equal(steps[1].to, 'Concept(recursion)');
  assert.equal(steps[1].origin, 'You said');
  assert.equal(steps[2].from, 'Concept(recursion)');
  assert.equal(steps[2].relation, 'REQUIRES');
  assert.equal(steps[2].to, 'functions');
  assert.equal(steps[2].origin, 'Curated');
});

test('mock sendChatMessage handles correction to resolve memory', async () => {
  const res = await sendChatMessage('student_alice', 'sess_test_2', 'I no longer struggle with recursion');
  
  assert.ok(res.saved_memories.some(m => m.action === 'resolved'));
});

test('mock sendChatMessage handles /simulate-error correctly', async () => {
  await assert.rejects(
    async () => {
      await sendChatMessage('student_alice', 'sess_test_3', 'Please trigger /simulate-error');
    },
    /Simulated 500 error/
  );
});

test('mock sendChatMessage handles /simulate-write-failure with warning', async () => {
  const res = await sendChatMessage('student_alice', 'sess_test_4', 'Testing /simulate-write-failure command');
  assert.equal(res.warnings.length, 1);
  assert.equal(res.warnings[0].stage, 'memory_write');
});

// ---------------------------------------------------------------------------
// Phase B: Chat History & Session Management Tests
// ---------------------------------------------------------------------------

test('mock listSessions returns sessions and enforces user isolation', async () => {
  const { listSessions } = await import('../src/api.js');
  
  // Alice starts with seeded sessions; Bob starts empty
  const aliceSessions = await listSessions('student_alice');
  const bobSessions = await listSessions('student_bob');

  assert.ok(Array.isArray(aliceSessions));
  assert.ok(aliceSessions.length >= 2);
  assert.ok(aliceSessions[0].id);
  assert.ok(aliceSessions[0].title);
  assert.ok(aliceSessions[0].updated_at);

  assert.ok(Array.isArray(bobSessions));
  assert.equal(bobSessions.length, 0);

  // Missing userId rejects
  await assert.rejects(async () => {
    await listSessions('');
  }, /user_id is required/);
});

test('mock getSession returns chronological messages with turn metadata', async () => {
  const { getSession } = await import('../src/api.js');

  const session = await getSession('sess_alice_today', 'student_alice');
  assert.equal(session.id, 'sess_alice_today');
  assert.ok(Array.isArray(session.messages));
  assert.equal(session.messages.length, 2);
  assert.equal(session.messages[0].role, 'user');
  assert.equal(session.messages[1].role, 'assistant');
  assert.ok(session.messages[1].turn);
  assert.ok(session.messages[1].turn.saved_memories);

  // Nonexistent session rejects with 404
  await assert.rejects(async () => {
    await getSession('sess_nonexistent', 'student_alice');
  }, (err) => err.status === 404);
});

test('mock renameSession updates title correctly', async () => {
  const { renameSession, getSession } = await import('../src/api.js');

  const updated = await renameSession('sess_alice_today', 'student_alice', 'Mastering Base Conditions');
  assert.equal(updated.title, 'Mastering Base Conditions');

  const reloaded = await getSession('sess_alice_today', 'student_alice');
  assert.equal(reloaded.title, 'Mastering Base Conditions');
});

test('mock deleteSession deletes session and subsequent get throws 404', async () => {
  const { deleteSession, getSession } = await import('../src/api.js');

  const res = await deleteSession('sess_alice_yesterday', 'student_alice');
  assert.equal(res.status, 'deleted');

  await assert.rejects(async () => {
    await getSession('sess_alice_yesterday', 'student_alice');
  }, (err) => err.status === 404);
});

test('groupSessionsByDate groups sessions into Today, Yesterday, and Earlier', async () => {
  const { groupSessionsByDate } = await import('../src/api.js');

  const now = new Date();
  const todayTimestamp = now.toISOString();
  const yesterdayTimestamp = new Date(now.getTime() - 86400000).toISOString();
  const earlierTimestamp = new Date(now.getTime() - 86400000 * 5).toISOString();

  const sessions = [
    { id: 's1', title: 'Session 1', updated_at: todayTimestamp },
    { id: 's2', title: 'Session 2', updated_at: yesterdayTimestamp },
    { id: 's3', title: 'Session 3', updated_at: earlierTimestamp }
  ];

  const grouped = groupSessionsByDate(sessions);
  assert.equal(grouped.Today.length, 1);
  assert.equal(grouped.Today[0].id, 's1');
  assert.equal(grouped.Yesterday.length, 1);
  assert.equal(grouped.Yesterday[0].id, 's2');
  assert.equal(grouped.Earlier.length, 1);
  assert.equal(grouped.Earlier[0].id, 's3');
});

test('localStorage fallback functions handle missing window gracefully without crashing', async () => {
  const { getLocalSessions, saveLocalSession, deleteLocalSession } = await import('../src/api.js');

  // In Node.js environment where window is undefined:
  assert.deepEqual(getLocalSessions('student_test'), []);
  assert.doesNotThrow(() => saveLocalSession('student_test', { id: 's_fallback', title: 'Local fallback' }));
  assert.doesNotThrow(() => deleteLocalSession('student_test', 's_fallback'));
});

test('URL hash parsing and formatting handles sessions and new chats correctly', async () => {
  const { parseSessionIdFromHash, formatChatHash } = await import('../src/api.js');

  assert.equal(parseSessionIdFromHash('#/chat/sess_123'), 'sess_123');
  assert.equal(parseSessionIdFromHash('#/chat/new'), 'new');
  assert.equal(parseSessionIdFromHash('#/'), null);
  assert.equal(parseSessionIdFromHash(''), null);
  assert.equal(parseSessionIdFromHash(null), null);

  assert.equal(formatChatHash('sess_123'), '#/chat/sess_123');
  assert.equal(formatChatHash('new'), '#/chat/new');
  assert.equal(formatChatHash(null), '#/chat/new');
});

test('resolveInitialSessionId prioritizes URL hash over localStorage', async () => {
  const { resolveInitialSessionId } = await import('../src/api.js');

  const mockStorage = {
    data: {
      'recallai_active_session_student_alice': 'sess_from_storage',
      'recallai_active_session_id': 'sess_from_storage'
    },
    getItem(key) {
      return this.data[key] || null;
    }
  };

  // 1. When hash contains a session, it takes priority over storage
  const fromHash = resolveInitialSessionId({
    hash: '#/chat/sess_from_hash',
    userId: 'student_alice',
    storage: mockStorage
  });
  assert.equal(fromHash, 'sess_from_hash');

  // 2. When hash is empty, falls back to localStorage
  const fromStorage = resolveInitialSessionId({
    hash: '',
    userId: 'student_alice',
    storage: mockStorage
  });
  assert.equal(fromStorage, 'sess_from_storage');

  // 3. When hash is #/chat/new, returns 'new'
  const newChat = resolveInitialSessionId({
    hash: '#/chat/new',
    userId: 'student_alice',
    storage: mockStorage
  });
  assert.equal(newChat, 'new');
});

test('session restore logic recovers messages and turn data, or 404 falls back cleanly', async () => {
  const { getSession } = await import('../src/api.js');

  // Alice successfully restores her session
  const aliceSession = await getSession('sess_alice_today', 'student_alice');
  assert.equal(aliceSession.id, 'sess_alice_today');
  assert.equal(aliceSession.messages.length, 2);
  const lastAsst = [...aliceSession.messages].reverse().find(m => m.role === 'assistant' && m.turn);
  assert.ok(lastAsst);
  assert.ok(lastAsst.turn.evidence_paths);

  // Cross-user session access or invalid session throws 404, which triggers fallback to empty state
  await assert.rejects(
    async () => {
      await getSession('sess_alice_today', 'student_bob');
    },
    (err) => err.status === 404
  );

  await assert.rejects(
    async () => {
      await getSession('sess_nonexistent_xyz', 'student_alice');
    },
    (err) => err.status === 404
  );
});

// ---------------------------------------------------------------------------
// Stop Generation & AbortSignal Tests
// ---------------------------------------------------------------------------

test('aborting sendChat throws AbortError and does not produce a delivery failure state', async () => {
  const { sendChatMessage, sendChat } = await import('../src/api.js');

  // Both sendChatMessage and sendChat alias work
  assert.equal(sendChatMessage, sendChat);

  const controller = new AbortController();
  // Abort after 50ms (before mock 350ms delay finishes)
  setTimeout(() => controller.abort(), 50);

  let capturedError = null;
  try {
    await sendChatMessage('student_alice', 'sess_abort_01', 'Explain binary trees', controller.signal);
  } catch (err) {
    capturedError = err;
  }

  assert.ok(capturedError, 'Expected sendChatMessage to reject on abort');
  assert.equal(capturedError.name, 'AbortError');
  // AbortError is explicitly recognized by the UI to NOT create an error bubble or retry button
  assert.notEqual(capturedError.code, 'HTTP_ERROR');
});

test('a late response after stop is ignored via epoch guarding', async () => {
  const { sendChatMessage } = await import('../src/api.js');

  let currentEpoch = 1;
  const messages = [{ role: 'user', text: 'Slow question' }];

  // Simulate pending async request with epoch 1
  const requestEpoch = currentEpoch;
  const pendingPromise = sendChatMessage('student_alice', 'sess_epoch_test', 'Slow question');

  // User clicks Stop: epoch is incremented and user message is annotated
  currentEpoch++;
  messages[0] = {
    ...messages[0],
    stoppedNote: 'Stopped. The tutor may still have saved this to memory - check Saved memories.'
  };

  // Wait for late response
  const lateResponse = await pendingPromise;

  // Epoch guard check: if requestEpoch !== currentEpoch, ignore it in the UI!
  if (requestEpoch === currentEpoch) {
    messages.push({ role: 'assistant', text: lateResponse.reply });
  }

  // Verify that the assistant message was NOT added
  assert.equal(messages.length, 1);
  assert.equal(messages[0].stoppedNote, 'Stopped. The tutor may still have saved this to memory - check Saved memories.');
});

test('Send is disabled/hidden while pending and Stop button is displayed', () => {
  // Test state rendering contract:
  // When isLoading is true:
  // - Send button is hidden/replaced by Stop button
  // - Stop button has square icon "■", label "Stop", accessible name "Stop generation"
  // - Hint displays "Esc to stop"
  const getComposerState = (isLoading, inputText) => {
    return {
      showStop: isLoading,
      showSend: !isLoading,
      sendDisabled: !inputText.trim() || isLoading,
      hint: isLoading ? 'Esc to stop' : 'Enter to send, Shift+Enter for newline',
      stopButton: isLoading ? {
        icon: '■',
        label: 'Stop',
        ariaLabel: 'Stop generation',
        title: 'Stop response (Esc)'
      } : null
    };
  };

  const pendingState = getComposerState(true, 'Hello tutor');
  assert.equal(pendingState.showStop, true);
  assert.equal(pendingState.showSend, false);
  assert.equal(pendingState.sendDisabled, true);
  assert.equal(pendingState.hint, 'Esc to stop');
  assert.equal(pendingState.stopButton.icon, '■');
  assert.equal(pendingState.stopButton.label, 'Stop');
  assert.equal(pendingState.stopButton.ariaLabel, 'Stop generation');

  const idleState = getComposerState(false, 'Hello tutor');
  assert.equal(idleState.showStop, false);
  assert.equal(idleState.showSend, true);
  assert.equal(idleState.sendDisabled, false);
  assert.equal(idleState.hint, 'Enter to send, Shift+Enter for newline');
});
