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
  if (!api) return;
  await api.stop();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function insertQuiz(title, creatorId, questionIds) {
  const qids = questionIds || Array.from({ length: 5 }, () => new mongoose.Types.ObjectId());
  return Quiz.create({
    title,
    timeLimitMinutes: 15,
    questionIds: qids,
    creatorId,
    status: 'published',
    publishedAt: new Date(),
  });
}

async function insertAttempt({ quizId, studentId, score, total, percentage, questions }) {
  const ts = new Date();
  const resultQuestions = questions.map((q, i) => ({
    questionId: q.questionId || new mongoose.Types.ObjectId(),
    text: q.text || `Question ${i + 1}`,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    selectedIndex: q.selectedIndex !== undefined ? q.selectedIndex : (q.correct ? 0 : 1),
    correctIndex: 0,
    correct: Boolean(q.correct),
    topic: q.topic || 'General',
  }));

  return QuizAttempt.create({
    quizId,
    studentId,
    startedAt: new Date(Date.now() - 120_000),
    expiresAt: new Date(Date.now() + 120_000),
    submittedAt: ts,
    status: 'submitted',
    answers: new Map(),
    result: {
      score,
      total,
      percentage,
      gradedAt: ts,
      questions: resultQuestions,
    },
  });
}

async function getContributorQuizzes(headers) {
  const res = await fetch(`${api.baseUrl}/api/reports/contributor/quizzes`, { headers });
  return { status: res.status, body: await res.json() };
}

async function getSingleQuizStats(quizId, headers) {
  const res = await fetch(`${api.baseUrl}/api/reports/contributor/quizzes/${quizId}`, { headers });
  return { status: res.status, body: await res.json() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: TC-Rep-02 (CSQ-F-041) Contributor quiz statistics hand-calculated math
// ─────────────────────────────────────────────────────────────────────────────
//
// SEEDED DATA:
// Contributor A owns Quiz 1 ("Data Structures Quiz") with 5 questions (Q0, Q1, Q2, Q3, Q4).
// Five students take the quiz and submit:
//
//   Attempt 1: Q0:✓, Q1:✓, Q2:✓, Q3:✓, Q4:✓ => Score: 5/5
//   Attempt 2: Q0:✓, Q1:✓, Q2:✓, Q3:✓, Q4:✗ => Score: 4/5
//   Attempt 3: Q0:✓, Q1:✓, Q2:✓, Q3:✗, Q4:✗ => Score: 3/5
//   Attempt 4: Q0:✓, Q1:✓, Q2:✗, Q3:✗, Q4:✗ => Score: 2/5
//   Attempt 5: Q0:✓, Q1:✗, Q2:✗, Q3:✗, Q4:✗ => Score: 1/5
//
// HAND-CALCULATED EXPECTATIONS:
//   - attemptCount: 5
//   - scores: [5, 4, 3, 2, 1]
//   - highestScore: 5
//   - lowestScore: 1
//   - averageScore: (5 + 4 + 3 + 2 + 1) / 5 = 15 / 5 = 3.0
//
// PER-QUESTION CORRECTNESS:
//   - Q0 ("Binary Search"): 5/5 correct = 100.0%
//   - Q1 ("Linked List"):   4/5 correct = 80.0%
//   - Q2 ("Hash Table"):    3/5 correct = 60.0%
//   - Q3 ("Red-Black Tree"): 2/5 correct = 40.0%
//   - Q4 ("B-Tree Index"):  1/5 correct = 20.0%
//
// 3 HARDEST QUESTIONS (lowest percentage first):
//   1. "B-Tree Index"    -> 1/5 correct (20.0%)
//   2. "Red-Black Tree"  -> 2/5 correct (40.0%)
//   3. "Hash Table"      -> 3/5 correct (60.0%)
// ─────────────────────────────────────────────────────────────────────────────

test('TC-Rep-02: Contributor quiz statistics match hand-calculated metrics and hardest questions', { skip: !canUseDatabase }, async () => {
  const contribA = await createUserWithToken('contributor');
  const student1 = await createUserWithToken('student');
  const student2 = await createUserWithToken('student');
  const student3 = await createUserWithToken('student');
  const student4 = await createUserWithToken('student');
  const student5 = await createUserWithToken('student');

  const qIds = [
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
    new mongoose.Types.ObjectId(),
  ];

  const q0 = { questionId: qIds[0], text: 'Binary Search' };
  const q1 = { questionId: qIds[1], text: 'Linked List' };
  const q2 = { questionId: qIds[2], text: 'Hash Table' };
  const q3 = { questionId: qIds[3], text: 'Red-Black Tree' };
  const q4 = { questionId: qIds[4], text: 'B-Tree Index' };

  const quiz = await insertQuiz('Data Structures Quiz', contribA.user._id, qIds);

  // Attempt 1: 5/5
  await insertAttempt({
    quizId: quiz._id,
    studentId: student1.user._id,
    score: 5,
    total: 5,
    percentage: 100,
    questions: [
      { ...q0, correct: true },
      { ...q1, correct: true },
      { ...q2, correct: true },
      { ...q3, correct: true },
      { ...q4, correct: true },
    ],
  });

  // Attempt 2: 4/5
  await insertAttempt({
    quizId: quiz._id,
    studentId: student2.user._id,
    score: 4,
    total: 5,
    percentage: 80,
    questions: [
      { ...q0, correct: true },
      { ...q1, correct: true },
      { ...q2, correct: true },
      { ...q3, correct: true },
      { ...q4, correct: false },
    ],
  });

  // Attempt 3: 3/5
  await insertAttempt({
    quizId: quiz._id,
    studentId: student3.user._id,
    score: 3,
    total: 5,
    percentage: 60,
    questions: [
      { ...q0, correct: true },
      { ...q1, correct: true },
      { ...q2, correct: true },
      { ...q3, correct: false },
      { ...q4, correct: false },
    ],
  });

  // Attempt 4: 2/5
  await insertAttempt({
    quizId: quiz._id,
    studentId: student4.user._id,
    score: 2,
    total: 5,
    percentage: 40,
    questions: [
      { ...q0, correct: true },
      { ...q1, correct: true },
      { ...q2, correct: false },
      { ...q3, correct: false },
      { ...q4, correct: false },
    ],
  });

  // Attempt 5: 1/5
  await insertAttempt({
    quizId: quiz._id,
    studentId: student5.user._id,
    score: 1,
    total: 5,
    percentage: 20,
    questions: [
      { ...q0, correct: true },
      { ...q1, correct: false },
      { ...q2, correct: false },
      { ...q3, correct: false },
      { ...q4, correct: false },
    ],
  });

  const { status, body } = await getContributorQuizzes(contribA.headers);
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.quizzes));
  assert.equal(body.quizzes.length, 1);

  const stats = body.quizzes[0];
  assert.equal(stats.quizTitle, 'Data Structures Quiz');
  assert.equal(stats.attemptCount, 5, 'attempt count must be 5');
  assert.equal(stats.highestScore, 5, 'highest score must be 5');
  assert.equal(stats.lowestScore, 1, 'lowest score must be 1');
  assert.equal(stats.averageScore, 3.0, 'average score must be 3.0');

  // Verify the 3 hardest questions exactly
  assert.equal(stats.hardestQuestions.length, 3, 'must return exactly 3 hardest questions');

  // Hardest 1: Q4 ("B-Tree Index") with 20.0%
  assert.equal(stats.hardestQuestions[0].text, 'B-Tree Index');
  assert.equal(stats.hardestQuestions[0].correctPercentage, 20.0);
  assert.equal(stats.hardestQuestions[0].correctCount, 1);
  assert.equal(stats.hardestQuestions[0].totalAttempts, 5);

  // Hardest 2: Q3 ("Red-Black Tree") with 40.0%
  assert.equal(stats.hardestQuestions[1].text, 'Red-Black Tree');
  assert.equal(stats.hardestQuestions[1].correctPercentage, 40.0);
  assert.equal(stats.hardestQuestions[1].correctCount, 2);
  assert.equal(stats.hardestQuestions[1].totalAttempts, 5);

  // Hardest 3: Q2 ("Hash Table") with 60.0%
  assert.equal(stats.hardestQuestions[2].text, 'Hash Table');
  assert.equal(stats.hardestQuestions[2].correctPercentage, 60.0);
  assert.equal(stats.hardestQuestions[2].correctCount, 3);
  assert.equal(stats.hardestQuestions[2].totalAttempts, 5);

  // Verify single quiz endpoint returns identical values
  const single = await getSingleQuizStats(quiz._id, contribA.headers);
  assert.equal(single.status, 200);
  assert.equal(single.body.attemptCount, 5);
  assert.equal(single.body.averageScore, 3.0);
  assert.equal(single.body.highestScore, 5);
  assert.equal(single.body.lowestScore, 1);
  assert.equal(single.body.hardestQuestions[0].text, 'B-Tree Index');
});

test('a quiz with no attempts returns zeroed statistics and empty hardest questions', { skip: !canUseDatabase }, async () => {
  const contrib = await createUserWithToken('contributor');
  const quiz = await insertQuiz('Brand New Quiz', contrib.user._id);

  const { status, body } = await getContributorQuizzes(contrib.headers);
  assert.equal(status, 200);
  assert.equal(body.quizzes.length, 1);
  assert.equal(body.quizzes[0].quizTitle, 'Brand New Quiz');
  assert.equal(body.quizzes[0].attemptCount, 0);
  assert.equal(body.quizzes[0].averageScore, 0);
  assert.equal(body.quizzes[0].highestScore, 0);
  assert.equal(body.quizzes[0].lowestScore, 0);
  assert.deepEqual(body.quizzes[0].hardestQuestions, []);
});

test('strict isolation: Contributor cannot view another Contributor quizzes or single quiz stats', { skip: !canUseDatabase }, async () => {
  const contribA = await createUserWithToken('contributor');
  const contribB = await createUserWithToken('contributor');
  const student = await createUserWithToken('student');

  const quizA = await insertQuiz('Quiz Owned By A', contribA.user._id);
  const quizB = await insertQuiz('Quiz Owned By B', contribB.user._id);

  // Seed 1 attempt on Quiz B
  await insertAttempt({
    quizId: quizB._id,
    studentId: student.user._id,
    score: 5,
    total: 5,
    percentage: 100,
    questions: Array.from({ length: 5 }, (_, i) => ({ text: `QB_${i}`, correct: true })),
  });

  // Contributor A lists quizzes -> sees only Quiz A
  const resA = await getContributorQuizzes(contribA.headers);
  assert.equal(resA.status, 200);
  const quizIdsA = resA.body.quizzes.map(q => q.quizId.toString());
  assert.ok(quizIdsA.includes(quizA._id.toString()));
  assert.ok(!quizIdsA.includes(quizB._id.toString()), 'Contributor A must not see Contributor B quiz');

  // Contributor A tries to access Quiz B statistics directly -> 403 Access denied
  const directA = await getSingleQuizStats(quizB._id, contribA.headers);
  assert.equal(directA.status, 403, 'direct access to another contributor quiz must return 403');

  // Contributor B lists quizzes -> sees only Quiz B
  const resB = await getContributorQuizzes(contribB.headers);
  assert.equal(resB.status, 200);
  const quizIdsB = resB.body.quizzes.map(q => q.quizId.toString());
  assert.ok(quizIdsB.includes(quizB._id.toString()));
  assert.ok(!quizIdsB.includes(quizA._id.toString()), 'Contributor B must not see Contributor A quiz');
});

test('in_progress attempts are ignored in statistics calculations', { skip: !canUseDatabase }, async () => {
  const contrib = await createUserWithToken('contributor');
  const student = await createUserWithToken('student');
  const quiz = await insertQuiz('Active Exam', contrib.user._id);

  // Create an in_progress attempt
  await QuizAttempt.create({
    quizId: quiz._id,
    studentId: student.user._id,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    status: 'in_progress',
    answers: new Map(),
  });

  const { status, body } = await getContributorQuizzes(contrib.headers);
  assert.equal(status, 200);
  assert.equal(body.quizzes[0].attemptCount, 0, 'in_progress attempt must not be counted in statistics');
});

test('role-based access control: Students and Admins cannot access contributor statistics', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const admin = await createUserWithToken('admin');

  // Student gets 403
  const resStudent = await getContributorQuizzes(student.headers);
  assert.equal(resStudent.status, 403);
  assert.equal(resStudent.body.message, 'Access denied');

  // Admin gets 403
  const resAdmin = await getContributorQuizzes(admin.headers);
  assert.equal(resAdmin.status, 403);
  assert.equal(resAdmin.body.message, 'Access denied');

  // Anonymous (no token) gets 401
  const resAnon = await getContributorQuizzes({});
  assert.equal(resAnon.status, 401);
});
