require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

let api;

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Quiz, Question, QuizAttempt]);
});

test.after(async () => {
  if (api) await api.stop();
});

// ── helpers ───────────────────────────────────────────────────────────────────

/** Insert a minimal Quiz doc directly so we don't need 5 real questions. */
async function insertQuiz(title, creatorId) {
  const doc = await Quiz.create({
    title,
    timeLimitMinutes: 10,
    questionIds: Array.from({ length: 5 }, () => new mongoose.Types.ObjectId()),
    creatorId,
    status: 'published',
    publishedAt: new Date(),
  });
  return doc;
}

/**
 * Insert a submitted QuizAttempt with a pre-built result subdoc so we can
 * control score/total/percentage and per-question topic/correct values exactly.
 *
 * questions format: [{ topic, correct, selectedIndex }]
 *   selectedIndex defaults to 0 (answered); pass null to mark unanswered.
 */
async function insertAttempt({ studentId, quizId, submittedAt, score, total, percentage, questions = [] }) {
  const gradedAt = submittedAt || new Date();
  const resultQuestions = questions.map((q, i) => ({
    questionId: new mongoose.Types.ObjectId(),
    text: `Q${i}`,
    options: ['A', 'B', 'C', 'D'],
    selectedIndex: q.selectedIndex !== undefined ? q.selectedIndex : 0,
    correctIndex: 0,
    correct: q.correct,
    topic: q.topic,
  }));

  return QuizAttempt.create({
    quizId,
    studentId,
    startedAt: new Date(Date.now() - 60000),
    expiresAt: new Date(Date.now() + 60000),
    submittedAt: submittedAt || new Date(),
    status: 'submitted',
    answers: new Map(),
    result: { score, total, percentage, gradedAt, questions: resultQuestions },
  });
}

async function getReport(headers) {
  const res = await fetch(`${api.baseUrl}/api/reports/student/me`, { headers });
  return { status: res.status, body: await res.json() };
}

// ── Test: 3 attempts — overall average, per-topic, attempt list ───────────────

test('3 submitted attempts produce correct overall average, topics and attempt list', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const contrib = await createUserWithToken('contributor');

  const quiz1 = await insertQuiz('Algebra Quiz', contrib.user._id);
  const quiz2 = await insertQuiz('Calculus Quiz', contrib.user._id);

  const now = Date.now();
  // Attempt 1: 3/5 = 60%,  Algebra: 2 correct of 3 answered; Calculus: 1 of 2
  await insertAttempt({
    studentId: student.user._id, quizId: quiz1._id,
    submittedAt: new Date(now - 3000),
    score: 3, total: 5, percentage: 60,
    questions: [
      { topic: 'Algebra',  correct: true,  selectedIndex: 0 },
      { topic: 'Algebra',  correct: true,  selectedIndex: 0 },
      { topic: 'Algebra',  correct: false, selectedIndex: 1 },
      { topic: 'Calculus', correct: true,  selectedIndex: 0 },
      { topic: 'Calculus', correct: false, selectedIndex: 1 },
    ],
  });
  // Attempt 2: 4/5 = 80%,  Algebra: 1 correct of 1; Calculus: 3 of 4
  await insertAttempt({
    studentId: student.user._id, quizId: quiz2._id,
    submittedAt: new Date(now - 2000),
    score: 4, total: 5, percentage: 80,
    questions: [
      { topic: 'Algebra',  correct: true,  selectedIndex: 0 },
      { topic: 'Calculus', correct: true,  selectedIndex: 0 },
      { topic: 'Calculus', correct: true,  selectedIndex: 0 },
      { topic: 'Calculus', correct: true,  selectedIndex: 0 },
      { topic: 'Calculus', correct: false, selectedIndex: 2 },
    ],
  });
  // Attempt 3: 5/5 = 100%, Algebra: 2 of 2
  await insertAttempt({
    studentId: student.user._id, quizId: quiz1._id,
    submittedAt: new Date(now - 1000),
    score: 5, total: 5, percentage: 100,
    questions: [
      { topic: 'Algebra', correct: true, selectedIndex: 0 },
      { topic: 'Algebra', correct: true, selectedIndex: 0 },
      { topic: 'Algebra', correct: true, selectedIndex: 0 },
      { topic: 'Algebra', correct: true, selectedIndex: 0 },
      { topic: 'Algebra', correct: true, selectedIndex: 0 },
    ],
  });

  const { status, body } = await getReport(student.headers);
  assert.equal(status, 200);

  // Overall average: (60 + 80 + 100) / 3 = 80.0
  assert.equal(body.overallAveragePercentage, 80.0, 'overall average should be 80.0');

  // 3 attempts returned, newest first
  assert.equal(body.attempts.length, 3, 'should return 3 attempts');
  assert.equal(body.attempts[0].score, 5);
  assert.equal(body.attempts[0].total, 5);
  assert.equal(body.attempts[0].percentage, 100);
  assert.equal(body.attempts[2].percentage, 60);

  // Per-topic manual calculation from the data inserted above:
  // Algebra:  attempt1=(2 correct/3 answered), attempt2=(1/1), attempt3=(5/5) → 8/9
  // Calculus: attempt1=(1 correct/2 answered), attempt2=(3/4)                 → 4/6
  // (selectedIndex:0 is falsy but !== null so counts as answered)
  const algebraTopic = body.topics.find(t => t.topic === 'Algebra');
  const calculusTopic = body.topics.find(t => t.topic === 'Calculus');
  assert.ok(algebraTopic, 'Algebra topic should be present');
  assert.ok(calculusTopic, 'Calculus topic should be present');

  // Verify the percentage matches the ratio (correct/answered)*100 rounded to 1dp
  assert.equal(
    algebraTopic.percentage,
    parseFloat(((algebraTopic.correct / algebraTopic.answered) * 100).toFixed(1)),
    'Algebra percentage should equal correct/answered'
  );
  assert.equal(
    calculusTopic.percentage,
    parseFloat(((calculusTopic.correct / calculusTopic.answered) * 100).toFixed(1)),
    'Calculus percentage should equal correct/answered'
  );
  // Algebra: 3 questions in attempt1, 1 in attempt2, 5 in attempt3 = 9 answered, 2+1+5=8 correct
  assert.equal(algebraTopic.correct, 8);
  assert.equal(algebraTopic.answered, 9);
  // Calculus: 2 in attempt1, 4 in attempt2 = 6 answered, 1+3=4 correct
  assert.equal(calculusTopic.correct, 4);
  assert.equal(calculusTopic.answered, 6);
});

// ── Test: only the 20 newest of 25 attempts returned ─────────────────────────

test('only the 20 newest attempts are returned when there are 25', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const contrib = await createUserWithToken('contributor');
  const quiz = await insertQuiz('Pagination Quiz', contrib.user._id);

  const base = Date.now() - 25000;
  for (let i = 0; i < 25; i++) {
    await insertAttempt({
      studentId: student.user._id, quizId: quiz._id,
      submittedAt: new Date(base + i * 1000),
      score: i % 5, total: 5, percentage: (i % 5) * 20,
      questions: [{ topic: 'Maths', correct: true, selectedIndex: 0 }],
    });
  }

  const { status, body } = await getReport(student.headers);
  assert.equal(status, 200);
  assert.equal(body.attempts.length, 20, 'should return exactly 20 attempts');
  // Newest first: the 25th attempt (index 24) should be first
  const newest = new Date(body.attempts[0].submittedAt).getTime();
  const secondNewest = new Date(body.attempts[1].submittedAt).getTime();
  assert.ok(newest >= secondNewest, 'attempts should be sorted newest first');
});

// ── Test: another Student's attempts are never included ───────────────────────

test("another student's attempts are never included", { skip: !canUseDatabase }, async () => {
  const studentA = await createUserWithToken('student');
  const studentB = await createUserWithToken('student');
  const contrib = await createUserWithToken('contributor');
  const quiz = await insertQuiz('Isolation Quiz', contrib.user._id);

  await insertAttempt({
    studentId: studentB.user._id, quizId: quiz._id,
    submittedAt: new Date(), score: 5, total: 5, percentage: 100,
    questions: [{ topic: 'Physics', correct: true, selectedIndex: 0 }],
  });

  const { status, body } = await getReport(studentA.headers);
  assert.equal(status, 200);
  assert.equal(body.attempts.length, 0, 'should not see other student attempts');
  assert.equal(body.overallAveragePercentage, 0);
});

// ── Test: in_progress attempts are ignored ────────────────────────────────────

test('in_progress attempts are ignored', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const contrib = await createUserWithToken('contributor');
  const quiz = await insertQuiz('In-progress Quiz', contrib.user._id);

  // Insert only an in_progress attempt (no result subdoc)
  await QuizAttempt.create({
    quizId: quiz._id,
    studentId: student.user._id,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60000),
    status: 'in_progress',
    answers: new Map(),
  });

  const { status, body } = await getReport(student.headers);
  assert.equal(status, 200);
  assert.equal(body.attempts.length, 0, 'in_progress attempts should not appear');
  assert.equal(body.overallAveragePercentage, 0);
});

// ── Test: Student with no attempts gets empty lists ───────────────────────────

test('a Student with no attempts gets empty lists and 0', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');

  const { status, body } = await getReport(student.headers);
  assert.equal(status, 200);
  assert.equal(body.overallAveragePercentage, 0);
  assert.deepEqual(body.topics, []);
  assert.deepEqual(body.attempts, []);
});

// ── Test: Contributor gets 403 ────────────────────────────────────────────────

test('a Contributor gets 403 Access denied', { skip: !canUseDatabase }, async () => {
  const contrib = await createUserWithToken('contributor');
  const { status, body } = await getReport(contrib.headers);
  assert.equal(status, 403);
  assert.equal(body.message, 'Access denied');
});

// ── Test: Admin gets 403 ─────────────────────────────────────────────────────

test('an Admin gets 403 Access denied', { skip: !canUseDatabase }, async () => {
  const admin = await createUserWithToken('admin');
  const { status, body } = await getReport(admin.headers);
  assert.equal(status, 403);
  assert.equal(body.message, 'Access denied');
});

// ── Test: no token gets 401 ──────────────────────────────────────────────────

test('no token gets 401', { skip: !canUseDatabase }, async () => {
  const res = await fetch(`${api.baseUrl}/api/reports/student/me`);
  assert.equal(res.status, 401);
});
