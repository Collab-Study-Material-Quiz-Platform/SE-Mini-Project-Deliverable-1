const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

let api;
let owner;
let other;
let student;
let questionIds = [];

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Question, Quiz]);
  owner = await createUserWithToken('contributor');
  other = await createUserWithToken('contributor');
  student = await createUserWithToken('student');
  const questions = await Question.insertMany(Array.from({ length: 51 }, (_, i) => ({
    text: `Create quiz question ${i}`, options: ['a', 'b', 'c', 'd'], correctIndex: i % 4,
    topic: 'Algebra', topicKey: 'algebra', difficulty: 'Easy', ownerId: owner.user._id,
  })));
  questionIds = questions.map(question => question._id.toString());
});

test.after(async () => {
  if (!api) return;
  await Quiz.deleteMany({ creatorId: { $in: [owner.user._id, other.user._id] } });
  await Question.deleteMany({ ownerId: owner.user._id });
  await api.stop();
});

async function request(method, path, { body, user = owner } = {}) {
  const response = await fetch(`${api.baseUrl}/api/quizzes${path}`, {
    method,
    headers: { ...user.headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

const create = (count, minutes, user) => request('POST', '', { body: { title: `Quiz ${count}/${minutes}`, timeLimitMinutes: minutes, questionIds: questionIds.slice(0, count) }, user });

test('TC-Quiz-01: quizzes with 5 or 50 questions and 5 or 180 minutes are created as drafts', { skip: !canUseDatabase }, async () => {
  for (const [count, minutes] of [[5, 5], [50, 180]]) {
    const { status, body } = await create(count, minutes);
    assert.equal(status, 201);
    assert.equal(body.message, 'Quiz created');
    assert.equal(body.quiz.status, 'draft');
    assert.equal(body.quiz.questionCount, count);
    assert.equal(body.quiz.timeLimitMinutes, minutes);
    assert.equal(body.quiz.creatorId, owner.user._id.toString());
  }
});

test('TC-Quiz-01: 4 or 51 questions and 4 or 181 minutes are rejected', { skip: !canUseDatabase }, async () => {
  for (const count of [4, 51]) {
    const { status, body } = await create(count, 10);
    assert.equal(status, 400);
    assert.equal(body.message, 'Quiz must contain 5 to 50 questions');
  }
  for (const minutes of [4, 181]) {
    const { status, body } = await create(5, minutes);
    assert.equal(status, 400);
    assert.equal(body.message, 'Time limit must be between 5 and 180 minutes');
  }
});

test('a quiz can only use questions that exist', { skip: !canUseDatabase }, async () => {
  const missing = [...questionIds.slice(0, 4), new mongoose.Types.ObjectId().toString()];
  const { status, body } = await request('POST', '', { body: { title: 'Missing question', timeLimitMinutes: 10, questionIds: missing } });
  assert.equal(status, 400);
  assert.equal(body.message, 'All selected questions must exist');
});

test('only contributors can create quizzes', { skip: !canUseDatabase }, async () => {
  const { status, body } = await create(5, 10, student);
  assert.equal(status, 403);
  assert.equal(body.message, 'Access denied');
});

test('TC-Quiz-01: publishing makes the quiz available to students', { skip: !canUseDatabase }, async () => {
  const { body: created } = await create(5, 15);
  const before = await fetch(`${api.baseUrl}/api/quizzes/published`, { headers: student.headers }).then(response => response.json());
  assert.equal(before.quizzes.some(quiz => quiz.id === created.quiz.id), false);

  const { status, body } = await request('POST', `/${created.quiz.id}/publish`);
  assert.equal(status, 200);
  assert.equal(body.message, 'Quiz published');
  assert.equal(body.quiz.status, 'published');
  assert.ok(body.quiz.publishedAt);

  const after = await fetch(`${api.baseUrl}/api/quizzes/published`, { headers: student.headers }).then(response => response.json());
  assert.equal(after.quizzes.some(quiz => quiz.id === created.quiz.id), true);
});

test('only the quiz creator can publish it', { skip: !canUseDatabase }, async () => {
  const { body: created } = await create(5, 15);
  const { status, body } = await request('POST', `/${created.quiz.id}/publish`, { user: other });
  assert.equal(status, 403);
  assert.equal(body.message, 'Access denied');
  assert.equal((await Quiz.findById(created.quiz.id)).status, 'draft');
});

test('publishing an unknown or malformed quiz id returns 404', { skip: !canUseDatabase }, async () => {
  assert.equal((await request('POST', `/${new mongoose.Types.ObjectId()}/publish`)).status, 404);
  assert.equal((await request('POST', '/not-an-id/publish')).status, 404);
});

// Defect D-07: the publish route does not check the quiz status, so a soft-deleted quiz can be published again.
test('a removed quiz cannot be published again', { skip: !canUseDatabase, todo: 'Defect D-07: publish does not reject removed quizzes' }, async () => {
  const { body: created } = await create(5, 15);
  await request('POST', `/${created.quiz.id}/publish`);
  assert.equal((await request('DELETE', `/${created.quiz.id}`)).status, 200);

  const { status } = await request('POST', `/${created.quiz.id}/publish`);
  assert.equal(status, 404);
  assert.equal((await Quiz.findById(created.quiz.id)).status, 'removed');
});
