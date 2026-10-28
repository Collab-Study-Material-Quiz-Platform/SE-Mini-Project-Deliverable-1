const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

let api;
let contributorA;
let contributorB;
let student;
const quizIds = [];

const baseQuestion = {
  text: 'What is the area of a square with side 3?',
  options: ['6', '9', '12', '3'],
  correctIndex: 1,
  topic: 'Geometry',
  difficulty: 'Medium',
};

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Question]);
  contributorA = await createUserWithToken('contributor');
  contributorB = await createUserWithToken('contributor');
  student = await createUserWithToken('student');
});

test.after(async () => {
  if (!api) return;
  await Question.deleteMany({ ownerId: { $in: [contributorA.user._id, contributorB.user._id] } });
  await mongoose.connection.collection('quizzes').deleteMany({ _id: { $in: quizIds } });
  await api.stop();
});

async function request(method, path, { body, user = contributorA } = {}) {
  const response = await fetch(`${api.baseUrl}/api/questions${path}`, {
    method,
    headers: { ...user.headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function createQuestion(user = contributorA, changes = {}) {
  const { status, body } = await request('POST', '', { body: { ...baseQuestion, ...changes }, user });
  assert.equal(status, 201);
  return body.question;
}

// Stand-in for a quiz created by the quiz module, using the SAD quiz document shape.
async function insertQuiz(status, questionIds, ownerId = contributorB.user._id) {
  const { insertedId } = await mongoose.connection.collection('quizzes').insertOne({
    title: 'Geometry check',
    timeLimitMinutes: 10,
    questionIds: questionIds.map(id => new mongoose.Types.ObjectId(String(id))),
    questionCount: questionIds.length,
    status,
    ownerId,
    createdAt: new Date(),
  });
  quizIds.push(insertedId);
  return insertedId;
}

test('a contributor edits their own question', { skip: !canUseDatabase }, async () => {
  const question = await createQuestion();
  const changes = { ...baseQuestion, text: 'What is the area of a square with side 4?', options: ['8', '16', '12', '4'], difficulty: 'hard' };
  const { status, body } = await request('PUT', `/${question.id}`, { body: changes });

  assert.equal(status, 200);
  assert.equal(body.message, 'Question updated');
  assert.equal(body.question.text, changes.text);
  assert.equal(body.question.difficulty, 'Hard');

  const saved = await Question.findById(question.id);
  assert.deepEqual([...saved.options], ['8', '16', '12', '4']);
});

test('an edit must still be a valid question', { skip: !canUseDatabase }, async () => {
  const question = await createQuestion();
  const { status, body } = await request('PUT', `/${question.id}`, { body: { ...baseQuestion, options: ['1', '2'] } });
  assert.equal(status, 400);
  assert.equal(body.message, 'Exactly four options are required');
  assert.equal((await Question.findById(question.id)).options.length, 4);
});

test('a contributor deletes their own unused question', { skip: !canUseDatabase }, async () => {
  const question = await createQuestion();
  const { status, body } = await request('DELETE', `/${question.id}`);
  assert.equal(status, 200);
  assert.equal(body.message, 'Question deleted');
  assert.equal(await Question.findById(question.id), null);
});

test('another contributor cannot edit or delete the question', { skip: !canUseDatabase }, async () => {
  const question = await createQuestion(contributorA);

  const edit = await request('PUT', `/${question.id}`, { body: { ...baseQuestion, text: 'Hijacked' }, user: contributorB });
  assert.equal(edit.status, 403);
  assert.equal(edit.body.message, 'Access denied');

  const remove = await request('DELETE', `/${question.id}`, { user: contributorB });
  assert.equal(remove.status, 403);
  assert.equal(remove.body.message, 'Access denied');

  const saved = await Question.findById(question.id);
  assert.equal(saved.text, baseQuestion.text);
});

test('students cannot edit or delete questions', { skip: !canUseDatabase }, async () => {
  const question = await createQuestion();
  assert.equal((await request('PUT', `/${question.id}`, { body: baseQuestion, user: student })).status, 403);
  assert.equal((await request('DELETE', `/${question.id}`, { user: student })).status, 403);
  assert.ok(await Question.findById(question.id));
});

test('a question used in a published quiz cannot be deleted', { skip: !canUseDatabase }, async () => {
  const question = await createQuestion();
  await insertQuiz('published', [question.id]);

  const { status, body } = await request('DELETE', `/${question.id}`);
  assert.equal(status, 409);
  assert.equal(body.message, 'Question is in use');
  assert.ok(await Question.findById(question.id));
});

test('a question used only in draft or removed quizzes can be deleted', { skip: !canUseDatabase }, async () => {
  const question = await createQuestion();
  await insertQuiz('draft', [question.id]);
  await insertQuiz('removed', [question.id]);

  assert.equal((await request('DELETE', `/${question.id}`)).status, 200);
});

test('unknown and malformed question ids return 404', { skip: !canUseDatabase }, async () => {
  const unknown = new mongoose.Types.ObjectId().toString();
  assert.equal((await request('PUT', `/${unknown}`, { body: baseQuestion })).status, 404);
  const missing = await request('DELETE', `/${unknown}`);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.message, 'Question not found');
  assert.equal((await request('DELETE', '/not-an-id')).status, 404);
});
