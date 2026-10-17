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
