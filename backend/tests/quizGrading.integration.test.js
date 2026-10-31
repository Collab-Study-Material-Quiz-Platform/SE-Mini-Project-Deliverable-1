const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { signToken } = require('../utils/authToken');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

let api;
let contributor;
let student;

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Question, Quiz, QuizAttempt]);
  contributor = await createUserWithToken('contributor');
  student = await createUserWithToken('student');
});

test.after(async () => {
  if (!api) return;
  const quizzes = await Quiz.find({ creatorId: contributor.user._id }).select('_id').lean();
  await QuizAttempt.deleteMany({ quizId: { $in: quizzes.map(quiz => quiz._id) } });
  await Quiz.deleteMany({ creatorId: contributor.user._id });
  await Question.deleteMany({ ownerId: contributor.user._id });
  await api.stop();
});

async function createPublishedQuiz(questionCount) {
  const questions = [];
  for (let i = 0; i < questionCount; i += 1) {
    questions.push(await Question.create({
      text: `Question ${i}`,
      options: ['first', 'second', 'third', 'fourth'],
      correctIndex: i % 4,
      topic: i % 2 === 0 ? 'Algebra' : 'Geometry',
      difficulty: 'Easy',
      ownerId: contributor.user._id,
    }));
  }
  const quiz = await Quiz.create({
    title: 'Graded quiz',
    timeLimitMinutes: 10,
    questionIds: questions.map(question => question._id),
    creatorId: contributor.user._id,
    status: 'published',
    publishedAt: new Date(),
  });
  return { quiz, questions };
}

async function request(method, path, { body, headers = student.headers } = {}) {
  const response = await fetch(`${api.baseUrl}/api/quizzes${path}`, {
    method,
    headers: { ...headers, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
}

async function startAttempt(quiz, headers = student.headers) {
  const { status, body } = await request('POST', `/${quiz._id}/attempts`, { headers });
  assert.equal(status, 201);
  return body;
}

async function answer(attemptId, question, selectedIndex) {
  const { status, body } = await request('PUT', `/attempts/${attemptId}/answers`, {
    body: { questionId: question._id.toString(), selectedIndex },
  });
  assert.equal(status, 200);
  return body;
}

function wrongIndex(question) {
  return (question.correctIndex + 1) % 4;
}

function expire(attemptId) {
  return QuizAttempt.updateOne({ _id: attemptId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
}

test('TC-Quiz-03: 7 correct answers out of 10 show 7/10, 70% and every correct answer within 3 s', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(10);
  const { attempt } = await startAttempt(quiz);
  for (const question of questions.slice(0, 7)) await answer(attempt.id, question, question.correctIndex);
  for (const question of questions.slice(7, 9)) await answer(attempt.id, question, wrongIndex(question));

  const startedAt = Date.now();
  const { status, body } = await request('POST', `/attempts/${attempt.id}/submit`);
  const elapsed = Date.now() - startedAt;

  assert.equal(status, 200);
  assert.ok(elapsed < 3000, `grading took ${elapsed}ms`);
  assert.equal(body.attempt.status, 'submitted');
  const { result } = body.attempt;
  assert.equal(result.score, 7);
  assert.equal(result.total, 10);
  assert.equal(result.percentage, 70);
  assert.deepEqual(result.questions.map(item => item.correctIndex), questions.map(question => question.correctIndex));
  assert.deepEqual(result.questions.map(item => item.correct), [...Array(7).fill(true), ...Array(3).fill(false)]);
  assert.equal(result.questions[9].selectedIndex, null);
  assert.equal(result.questions[0].topic, 'Algebra');

  const saved = await QuizAttempt.findById(attempt.id);
  assert.equal(saved.result.score, 7);
});

test('an attempt with no answers scores 0', { skip: !canUseDatabase }, async () => {
  const { quiz } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  const { body } = await request('POST', `/attempts/${attempt.id}/submit`);
  assert.equal(body.attempt.result.score, 0);
  assert.equal(body.attempt.result.total, 5);
  assert.equal(body.attempt.result.percentage, 0);
});

test('correct answers are never sent before the attempt is finished', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(5);
  const started = await startAttempt(quiz);
  const saved = await answer(started.attempt.id, questions[0], 0);
  const loaded = await request('GET', `/attempts/${started.attempt.id}`);

  for (const payload of [started, saved, loaded.body]) {
    assert.equal(JSON.stringify(payload).includes('correctIndex'), false);
    assert.equal(payload.attempt.result, undefined);
  }
});

test('a second submit returns 409 with the original result', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  await answer(attempt.id, questions[0], questions[0].correctIndex);
  const first = await request('POST', `/attempts/${attempt.id}/submit`);
  assert.equal(first.status, 200);

  const second = await request('POST', `/attempts/${attempt.id}/submit`);
  assert.equal(second.status, 409);
  assert.equal(second.body.message, 'Quiz attempt is already submitted');
  assert.deepEqual(second.body.attempt.result, first.body.attempt.result);
});

test('simultaneous submits of one attempt grade it only once', { skip: !canUseDatabase }, async () => {
  const { quiz } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  const responses = await Promise.all(Array.from({ length: 5 }, () => request('POST', `/attempts/${attempt.id}/submit`)));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 409, 409, 409, 409]);
});

test('a past result does not change when a question is edited later', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  await answer(attempt.id, questions[1], questions[1].correctIndex);
  await request('POST', `/attempts/${attempt.id}/submit`);

  await Question.updateOne({ _id: questions[1]._id }, { $set: { correctIndex: wrongIndex(questions[1]), text: 'Edited' } });
  const { body } = await request('GET', `/attempts/${attempt.id}`);
  assert.equal(body.attempt.result.score, 1);
  assert.equal(body.attempt.result.questions[1].text, 'Question 1');
});

test('after the time limit the answers given so far are graded and the status is timed_out', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  await answer(attempt.id, questions[0], questions[0].correctIndex);
  await expire(attempt.id);

  const { status, body } = await request('POST', `/attempts/${attempt.id}/submit`);
  assert.equal(status, 200);
  assert.equal(body.attempt.status, 'timed_out');
  assert.equal(body.attempt.result.score, 1);
});

test('opening an expired attempt also grades it', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  await answer(attempt.id, questions[0], questions[0].correctIndex);
  await expire(attempt.id);

  const { body } = await request('GET', `/attempts/${attempt.id}`);
  assert.equal(body.attempt.status, 'timed_out');
  assert.equal(body.attempt.result.score, 1);
});

test('an answer saved too late is refused, is not counted and returns the result', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  await expire(attempt.id);

  const { status, body } = await request('PUT', `/attempts/${attempt.id}/answers`, {
    body: { questionId: questions[0]._id.toString(), selectedIndex: questions[0].correctIndex },
  });
  assert.equal(status, 409);
  assert.equal(body.message, 'Time is up');
  assert.equal(body.attempt.result.score, 0);
});

test('each attempt is graded separately', { skip: !canUseDatabase }, async () => {
  const { quiz, questions } = await createPublishedQuiz(5);
  const first = await startAttempt(quiz);
  await answer(first.attempt.id, questions[0], questions[0].correctIndex);
  const second = await startAttempt(quiz);

  assert.equal((await request('POST', `/attempts/${first.attempt.id}/submit`)).body.attempt.result.score, 1);
  assert.equal((await request('POST', `/attempts/${second.attempt.id}/submit`)).body.attempt.result.score, 0);
});

test('only the student who owns an attempt can submit it', { skip: !canUseDatabase }, async () => {
  const { quiz } = await createPublishedQuiz(5);
  const { attempt } = await startAttempt(quiz);
  const otherStudent = await createUserWithToken('student');

  const asOther = await request('POST', `/attempts/${attempt.id}/submit`, { headers: otherStudent.headers });
  assert.equal(asOther.status, 404);
  assert.equal((await request('POST', `/attempts/${attempt.id}/submit`, { headers: contributor.headers })).status, 403);
  assert.equal((await request('POST', `/attempts/${attempt.id}/submit`, { headers: {} })).status, 401);
  assert.equal((await request('POST', '/attempts/not-an-id/submit')).status, 404);
  assert.equal((await QuizAttempt.findById(attempt.id)).status, 'in_progress');
});

test('100 simultaneous submissions return results within 3 s for at least 95%', { skip: !canUseDatabase, timeout: 120000 }, async () => {
  const { quiz, questions } = await createPublishedQuiz(10);
  const answers = Object.fromEntries(questions.map(question => [question._id.toString(), question.correctIndex]));
  const now = Date.now();
  const attempts = Array.from({ length: 100 }, () => ({
    _id: new mongoose.Types.ObjectId(),
    quizId: quiz._id,
    studentId: new mongoose.Types.ObjectId(),
    startedAt: new Date(now),
    expiresAt: new Date(now + 600000),
    status: 'in_progress',
    answers,
  }));
  await QuizAttempt.collection.insertMany(attempts);

  const durations = await Promise.all(attempts.map(async (attempt) => {
    const token = signToken({ sub: attempt.studentId.toString(), role: 'student' });
    const startedAt = Date.now();
    const { status, body } = await request('POST', `/attempts/${attempt._id}/submit`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(status, 200);
    assert.equal(body.attempt.result.score, 10);
    return Date.now() - startedAt;
  }));

  durations.sort((a, b) => a - b);
  assert.ok(durations[94] <= 3000, `95th percentile was ${durations[94]}ms`);
});
