const test = require('node:test');
const assert = require('node:assert/strict');
const Question = require('../models/Question');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

// Unique topic names per run keep the filters independent of questions left by other runs.
const runId = `${process.pid}-${Date.now()}`;
const algebra = `Algebra ${runId}`;
const geometry = `Geometry ${runId}`;
let api;
let contributor;
const ids = {};

const sample = { text: 'Sample question', options: ['a', 'b', 'c', 'd'], correctIndex: 0 };

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Question]);
  contributor = await createUserWithToken('contributor');

  for (const topic of [algebra, geometry]) {
    for (const difficulty of ['Easy', 'Medium', 'Hard']) {
      const { status, body } = await post({ ...sample, text: `${topic} ${difficulty}`, topic, difficulty });
      assert.equal(status, 201);
      ids[`${topic}/${difficulty}`] = body.question.id;
    }
  }
});

test.after(async () => {
  if (!api) return;
  await Question.deleteMany({ ownerId: contributor.user._id });
  await api.stop();
});

async function post(body) {
  const response = await fetch(`${api.baseUrl}/api/questions`, {
    method: 'POST',
    headers: { ...contributor.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function list(params) {
  const query = new URLSearchParams({ limit: '50', ...params });
  const response = await fetch(`${api.baseUrl}/api/questions?${query}`, { headers: contributor.headers });
  return { status: response.status, body: await response.json() };
}

test('a question without a topic or difficulty is not saved', { skip: !canUseDatabase }, async () => {
  const before = await Question.countDocuments({ ownerId: contributor.user._id });

  const noTopic = await post({ ...sample, difficulty: 'Easy' });
  assert.equal(noTopic.status, 400);
  assert.equal(noTopic.body.message, 'Topic is required');

  const noDifficulty = await post({ ...sample, topic: algebra });
  assert.equal(noDifficulty.status, 400);
  assert.equal(noDifficulty.body.message, 'Difficulty is required');

  const badDifficulty = await post({ ...sample, topic: algebra, difficulty: 'Impossible' });
  assert.equal(badDifficulty.status, 400);
  assert.equal(badDifficulty.body.message, 'Difficulty must be Easy, Medium or Hard');

  assert.equal(await Question.countDocuments({ ownerId: contributor.user._id }), before);
});

test('every saved question has exactly one topic and one difficulty', { skip: !canUseDatabase }, async () => {
  const saved = await Question.find({ ownerId: contributor.user._id }).lean();
  assert.equal(saved.length, 6);
  for (const question of saved) {
    assert.equal(typeof question.topic, 'string');
    assert.ok(['Easy', 'Medium', 'Hard'].includes(question.difficulty));
  }
});

test('filtering by topic returns only that topic, ignoring case', { skip: !canUseDatabase }, async () => {
  const { status, body } = await list({ topic: algebra.toUpperCase() });
  assert.equal(status, 200);
  assert.equal(body.total, 3);
  assert.ok(body.questions.every(question => question.topic === algebra));
});

test('filtering by difficulty returns only that difficulty', { skip: !canUseDatabase }, async () => {
  const { body } = await list({ difficulty: 'Hard' });
  assert.ok(body.questions.every(question => question.difficulty === 'Hard'));
  const returned = body.questions.map(question => question.id);
  assert.ok(returned.includes(ids[`${algebra}/Hard`]));
  assert.ok(returned.includes(ids[`${geometry}/Hard`]));
});

test('filtering by Algebra and Easy returns only matching questions', { skip: !canUseDatabase }, async () => {
  const { body } = await list({ topic: algebra, difficulty: 'Easy' });
  assert.equal(body.total, 1);
  assert.deepEqual(body.questions.map(question => question.id), [ids[`${algebra}/Easy`]]);
});

test('an unknown difficulty filter is rejected', { skip: !canUseDatabase }, async () => {
  const { status, body } = await list({ difficulty: 'Expert' });
  assert.equal(status, 400);
  assert.equal(body.message, 'Difficulty must be Easy, Medium or Hard');
});
