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
