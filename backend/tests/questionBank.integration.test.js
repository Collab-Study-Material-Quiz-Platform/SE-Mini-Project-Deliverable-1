const test = require('node:test');
const assert = require('node:assert/strict');
const Question = require('../models/Question');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

let api;
let contributor;
let student;

const validQuestion = {
  text: 'Which value of x solves 2x + 3 = 7?',
  options: ['1', '2', '3', '4'],
  correctIndex: 1,
  topic: 'Algebra',
  difficulty: 'Easy',
};

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Question]);
  contributor = await createUserWithToken('contributor');
  student = await createUserWithToken('student');
});

test.after(async () => {
  if (!api) return;
  await Question.deleteMany({ ownerId: contributor.user._id });
  await api.stop();
});

async function request(method, path, { body, headers = contributor.headers } = {}) {
  const response = await fetch(`${api.baseUrl}/api/questions${path}`, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

test('a contributor adds a valid 500-character question and it is persisted', { skip: !canUseDatabase }, async () => {
  const text = 'q'.repeat(500);
  const { status, body } = await request('POST', '', { body: { ...validQuestion, text } });

  assert.equal(status, 201);
  assert.equal(body.message, 'Question saved');
  assert.equal(body.question.text, text);
  assert.deepEqual(body.question.options, validQuestion.options);
  assert.equal(body.question.correctIndex, 1);
  assert.equal(body.question.ownerId, contributor.user._id.toString());

  const saved = await Question.findById(body.question.id);
  assert.equal(saved.text, text);
  assert.equal(saved.topic, 'Algebra');
  assert.equal(saved.difficulty, 'Easy');
});

test('a question with 3 options or with 2 correct options is rejected', { skip: !canUseDatabase }, async () => {
  const before = await Question.countDocuments({ ownerId: contributor.user._id });

  const threeOptions = await request('POST', '', { body: { ...validQuestion, options: ['1', '2', '3'] } });
  assert.equal(threeOptions.status, 400);
  assert.equal(threeOptions.body.message, 'Exactly four options are required');

  const twoCorrect = await request('POST', '', {
    body: { ...validQuestion, correctIndex: undefined, options: ['1', '2', '3', '4'].map((text, i) => ({ text, isCorrect: i >= 2 })) },
  });
  assert.equal(twoCorrect.status, 400);
  assert.equal(twoCorrect.body.message, 'Exactly one correct option is required');

  const tooLong = await request('POST', '', { body: { ...validQuestion, text: 'q'.repeat(501) } });
  assert.equal(tooLong.status, 400);

  assert.equal(await Question.countDocuments({ ownerId: contributor.user._id }), before);
});

test('saved questions appear in the question bank, newest first', { skip: !canUseDatabase }, async () => {
  const first = await request('POST', '', { body: { ...validQuestion, text: 'First of two' } });
  const second = await request('POST', '', { body: { ...validQuestion, text: 'Second of two' } });
  const { status, body } = await request('GET', '?limit=50');

  assert.equal(status, 200);
  const ids = body.questions.map(question => question.id);
  assert.ok(ids.indexOf(second.body.question.id) < ids.indexOf(first.body.question.id));
  assert.ok(body.pageSize <= 50);
});

test('only contributors can add or list questions', { skip: !canUseDatabase }, async () => {
  const asStudent = await request('POST', '', { body: validQuestion, headers: student.headers });
  assert.equal(asStudent.status, 403);
  assert.equal(asStudent.body.message, 'Access denied');
  assert.equal((await request('GET', '', { headers: student.headers })).status, 403);

  const admin = await createUserWithToken('admin');
  assert.equal((await request('POST', '', { body: validQuestion, headers: admin.headers })).status, 403);
  assert.equal((await request('POST', '', { body: validQuestion, headers: {} })).status, 401);
});

test('page size is capped at 50 and invalid paging is rejected', { skip: !canUseDatabase }, async () => {
  assert.equal((await request('GET', '?limit=500')).body.pageSize, 50);
  const invalid = await request('GET', '?page=0');
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.message, 'Page and limit must be positive whole numbers');
});
