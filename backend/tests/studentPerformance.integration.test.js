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

/** Insert a minimal Quiz doc directly (avoids needing 5 real Question docs). */
async function insertQuiz(title, creatorId) {
  return Quiz.create({
    title,
    timeLimitMinutes: 10,
    questionIds: Array.from({ length: 5 }, () => new mongoose.Types.ObjectId()),
    creatorId,
    status: 'published',
    publishedAt: new Date(),
  });
}

/**
 * Insert a QuizAttempt that is already graded (status: 'submitted', result subdoc
 * fully populated).  This mirrors what the grading step writes after a real attempt.
 *
 * questions: [{ topic, correct, selectedIndex }]
 *   selectedIndex: number → student answered that option (0–3 are all valid answers)
 *   selectedIndex: null   → student skipped the question (not counted in 'answered')
 */
async function insertAttempt({ studentId, quizId, submittedAt, score, total, percentage, questions = [] }) {
  const ts = submittedAt || new Date();
  const resultQuestions = questions.map((q, i) => ({
    questionId: new mongoose.Types.ObjectId(),
    text:        `Q${i}`,
    options:     ['A', 'B', 'C', 'D'],
    selectedIndex: q.selectedIndex !== undefined ? q.selectedIndex : 0,
    correctIndex:  0,
    correct:       q.correct,
    topic:         q.topic,
  }));

  return QuizAttempt.create({
    quizId,
    studentId,
    startedAt:   new Date(Date.now() - 60_000),
    expiresAt:   new Date(Date.now() + 60_000),
    submittedAt: ts,
    status:      'submitted',
    answers:     new Map(),
    result: { score, total, percentage, gradedAt: ts, questions: resultQuestions },
  });
}

async function getReport(headers) {
  const res = await fetch(`${api.baseUrl}/api/reports/student/me`, { headers });
  return { status: res.status, body: await res.json() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test: 3 submitted attempts — hand-calculated expectations
// ─────────────────────────────────────────────────────────────────────────────
//
// SEEDED DATA (all for the same student, three separate attempts):
//
// Attempt A  — quizTitle "Algebra Quiz",  score 3/5 = 60%,  oldest
//   Q0  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//   Q1  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//   Q2  topic=Algebra   correct=false  selectedIndex=1  (answered, wrong)
//   Q3  topic=Calculus  correct=true   selectedIndex=0  (answered, correct)
//   Q4  topic=Calculus  correct=false  selectedIndex=1  (answered, wrong)
//
// Attempt B  — quizTitle "Calculus Quiz",  score 4/5 = 80%,  middle
//   Q0  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//   Q1  topic=Calculus  correct=true   selectedIndex=0  (answered, correct)
//   Q2  topic=Calculus  correct=true   selectedIndex=0  (answered, correct)
//   Q3  topic=Calculus  correct=true   selectedIndex=0  (answered, correct)
//   Q4  topic=Calculus  correct=false  selectedIndex=2  (answered, wrong)
//
// Attempt C  — quizTitle "Algebra Quiz",  score 5/5 = 100%,  newest
//   Q0  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//   Q1  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//   Q2  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//   Q3  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//   Q4  topic=Algebra   correct=true   selectedIndex=0  (answered, correct)
//
// HAND CALCULATIONS:
//
//   Overall average:
//     (60 + 80 + 100) / 3 = 240 / 3 = 80.0 %
//
//   Algebra across all three attempts:
//     answered = 3 (A) + 1 (B) + 5 (C) = 9
//     correct  = 2 (A) + 1 (B) + 5 (C) = 8
//     percentage = 8 / 9 * 100 = 88.888… → rounded to 1 dp = 88.9 %
//
//   Calculus across all three attempts:
//     answered = 2 (A) + 4 (B) + 0 (C) = 6
//     correct  = 1 (A) + 3 (B) + 0 (C) = 4
//     percentage = 4 / 6 * 100 = 66.666… → rounded to 1 dp = 66.7 %
//
//   Attempts returned (last 20, newest first):
//     [0] Attempt C  score=5  total=5  percentage=100
//     [1] Attempt B  score=4  total=5  percentage=80
//     [2] Attempt A  score=3  total=5  percentage=60
//
// ─────────────────────────────────────────────────────────────────────────────

test('3 submitted attempts produce correct overall average, topics and attempt list', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const contrib = await createUserWithToken('contributor');

  const quiz1 = await insertQuiz('Algebra Quiz',   contrib.user._id);
  const quiz2 = await insertQuiz('Calculus Quiz',  contrib.user._id);

  const now = Date.now();

  // Attempt A — oldest
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

  // Attempt B — middle
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

  // Attempt C — newest
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

  // ── Overall average ──────────────────────────────────────────────────────
  // (60 + 80 + 100) / 3 = 80.0
  assert.equal(body.overallAveragePercentage, 80.0, 'overall average should be 80.0');

  // ── Attempt list: 3 entries, newest first ────────────────────────────────
  assert.equal(body.attempts.length, 3, 'should return exactly 3 attempts');

  // [0] = Attempt C (newest)
  assert.equal(body.attempts[0].quizTitle,   'Algebra Quiz', '[0] quiz title');
  assert.equal(body.attempts[0].score,       5,              '[0] score');
  assert.equal(body.attempts[0].total,       5,              '[0] total');
  assert.equal(body.attempts[0].percentage,  100,            '[0] percentage');

  // [1] = Attempt B
  assert.equal(body.attempts[1].quizTitle,   'Calculus Quiz', '[1] quiz title');
  assert.equal(body.attempts[1].score,       4,               '[1] score');
  assert.equal(body.attempts[1].total,       5,               '[1] total');
  assert.equal(body.attempts[1].percentage,  80,              '[1] percentage');

  // [2] = Attempt A (oldest)
  assert.equal(body.attempts[2].quizTitle,   'Algebra Quiz', '[2] quiz title');
  assert.equal(body.attempts[2].score,       3,              '[2] score');
  assert.equal(body.attempts[2].total,       5,              '[2] total');
  assert.equal(body.attempts[2].percentage,  60,             '[2] percentage');

  // ── Per-topic — all literals, no computation from server data ────────────
  const alg = body.topics.find(t => t.topic === 'Algebra');
  const cal = body.topics.find(t => t.topic === 'Calculus');
  assert.ok(alg, 'Algebra topic must be present');
  assert.ok(cal, 'Calculus topic must be present');

  // Algebra: 9 answered (3+1+5), 8 correct (2+1+5) → 88.9 %
  assert.equal(alg.answered,    9,    'Algebra answered');
  assert.equal(alg.correct,     8,    'Algebra correct');
  assert.equal(alg.percentage,  88.9, 'Algebra percentage = 8/9*100 = 88.9 %');

  // Calculus: 6 answered (2+4), 4 correct (1+3) → 66.7 %
  assert.equal(cal.answered,    6,    'Calculus answered');
  assert.equal(cal.correct,     4,    'Calculus correct');
  assert.equal(cal.percentage,  66.7, 'Calculus percentage = 4/6*100 = 66.7 %');
});

// ── Test: only the 20 newest of 25 attempts returned ─────────────────────────

test('only the 20 newest attempts are returned when there are 25', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const contrib = await createUserWithToken('contributor');
  const quiz = await insertQuiz('Pagination Quiz', contrib.user._id);

  // Create 25 attempts with strictly increasing submittedAt values.
  // The newest 20 (indices 5–24, i.e. offsets 5000 ms to 24000 ms from base) should be returned.
  const base = Date.now() - 25_000;
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

  // Newest first: body.attempts[0].submittedAt should be later than body.attempts[1].submittedAt
  const t0 = new Date(body.attempts[0].submittedAt).getTime();
  const t1 = new Date(body.attempts[1].submittedAt).getTime();
  assert.ok(t0 > t1, 'attempts should be sorted newest first');
});

// ── Test: another Student's attempts are never included ───────────────────────

test("another student's attempts are never included", { skip: !canUseDatabase }, async () => {
  const studentA = await createUserWithToken('student');
  const studentB = await createUserWithToken('student');
  const contrib  = await createUserWithToken('contributor');
  const quiz     = await insertQuiz('Isolation Quiz', contrib.user._id);

  await insertAttempt({
    studentId: studentB.user._id, quizId: quiz._id,
    submittedAt: new Date(), score: 5, total: 5, percentage: 100,
    questions: [{ topic: 'Physics', correct: true, selectedIndex: 0 }],
  });

  const { status, body } = await getReport(studentA.headers);
  assert.equal(status, 200);
  assert.equal(body.attempts.length,          0, 'studentA should see 0 attempts');
  assert.equal(body.overallAveragePercentage, 0, 'studentA average should be 0');
});

// ── Test: in_progress attempts are ignored ────────────────────────────────────

test('in_progress attempts are ignored', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const contrib = await createUserWithToken('contributor');
  const quiz    = await insertQuiz('In-progress Quiz', contrib.user._id);

  await QuizAttempt.create({
    quizId:    quiz._id,
    studentId: student.user._id,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 60_000),
    status:    'in_progress',
    answers:   new Map(),
  });

  const { status, body } = await getReport(student.headers);
  assert.equal(status, 200);
  assert.equal(body.attempts.length,          0, 'in_progress attempt should not appear');
  assert.equal(body.overallAveragePercentage, 0);
});

// ── Test: Student with no attempts gets empty lists ───────────────────────────

test('a Student with no attempts gets empty lists and 0', { skip: !canUseDatabase }, async () => {
  const student = await createUserWithToken('student');
  const { status, body } = await getReport(student.headers);
  assert.equal(status, 200);
  assert.equal(body.overallAveragePercentage, 0);
  assert.deepEqual(body.topics,   []);
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
