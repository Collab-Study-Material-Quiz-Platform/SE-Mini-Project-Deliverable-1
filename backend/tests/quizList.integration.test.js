const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

const runId = `${process.pid}-${Date.now()}`;
let api;
let contributor;
let student;

function questionIds(count) {
  return Array.from({ length: count }, () => new mongoose.Types.ObjectId());
}

// Inserted directly so that the test can also store the soft-deleted status from the SAD.
async function insertQuiz(title, status, count, timeLimitMinutes) {
  const now = new Date();
  await Quiz.collection.insertOne({
    title: `${title} ${runId}`,
    status,
    timeLimitMinutes,
    questionIds: questionIds(count),
    creatorId: contributor.user._id,
    publishedAt: status === 'draft' ? undefined : now,
    createdAt: now,
    updatedAt: now,
  });
}

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Quiz]);
  contributor = await createUserWithToken('contributor');
  student = await createUserWithToken('student');
  await insertQuiz('Algebra basics', 'published', 5, 15);
  await insertQuiz('Geometry final', 'published', 12, 90);
  await insertQuiz('Unfinished draft', 'draft', 6, 20);
  await insertQuiz('Removed quiz', 'removed', 7, 25);
});

test.after(async () => {
  if (!api) return;
  await Quiz.collection.deleteMany({ creatorId: contributor.user._id });
  await api.stop();
});

async function listPublished(headers = student.headers) {
  const response = await fetch(`${api.baseUrl}/api/quizzes/published`, { headers });
  return { status: response.status, body: await response.json() };
}

function ownQuizzes(body) {
  return body.quizzes.filter(quiz => quiz.title.endsWith(runId));
}

test('TC-Quiz-04: a student sees every published quiz with its title, question count and time limit', { skip: !canUseDatabase }, async () => {
  const { status, body } = await listPublished();
  assert.equal(status, 200);

  const quizzes = ownQuizzes(body);
  assert.equal(quizzes.length, 2);
  const algebra = quizzes.find(quiz => quiz.title.startsWith('Algebra basics'));
  assert.equal(algebra.questionCount, 5);
  assert.equal(algebra.timeLimitMinutes, 15);
  const geometry = quizzes.find(quiz => quiz.title.startsWith('Geometry final'));
  assert.equal(geometry.questionCount, 12);
  assert.equal(geometry.timeLimitMinutes, 90);
});

test('draft and removed quizzes are not listed', { skip: !canUseDatabase }, async () => {
  const titles = ownQuizzes((await listPublished()).body).map(quiz => quiz.title);
  assert.equal(titles.some(title => title.startsWith('Unfinished draft')), false);
  assert.equal(titles.some(title => title.startsWith('Removed quiz')), false);
});

test('list items do not reveal which questions a quiz contains', { skip: !canUseDatabase }, async () => {
  const [quiz] = ownQuizzes((await listPublished()).body);
  assert.deepEqual(Object.keys(quiz).sort(), ['id', 'publishedAt', 'questionCount', 'timeLimitMinutes', 'title']);
});

test('only students can list published quizzes', { skip: !canUseDatabase }, async () => {
  const admin = await createUserWithToken('admin');
  const asContributor = await listPublished(contributor.headers);
  assert.equal(asContributor.status, 403);
  assert.equal(asContributor.body.message, 'Access denied');
  assert.equal((await listPublished(admin.headers)).status, 403);
  assert.equal((await listPublished({})).status, 401);
});
