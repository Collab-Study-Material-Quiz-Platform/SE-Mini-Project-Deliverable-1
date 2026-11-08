// TC-Perf-02 (CSQ-NF-002): Display quiz result within 3s for >= 95% of submissions during 100 simultaneous student submissions.
// Run with `npm run perf:quiz-submit`; the same functions are used by tests/quizSubmitPerformance.integration.test.js.
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const QuizAttempt = require('../models/QuizAttempt');
const User = require('../models/User');
const { signToken } = require('../utils/authToken');

const TARGET_MS = 3000;
const TARGET_RATIO = 0.95;

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedValues.length);
  return sortedValues[Math.min(sortedValues.length, Math.max(1, rank)) - 1];
}

function summarise(durations, failures, totalBytes = 0) {
  const sorted = durations.slice().sort((a, b) => a - b);
  const withinTarget = sorted.filter(ms => ms <= TARGET_MS).length;
  const round = value => Math.round(value * 10) / 10;
  const p95 = percentile(sorted, 95);
  return {
    submissions: sorted.length,
    failures,
    meanMs: round(sorted.reduce((sum, ms) => sum + ms, 0) / (sorted.length || 1)),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(p95),
    p99Ms: round(percentile(sorted, 99)),
    maxMs: round(sorted[sorted.length - 1] || 0),
    withinTargetPercent: round((withinTarget / (sorted.length || 1)) * 100),
    meanResponseBytes: Math.round(totalBytes / (sorted.length || 1)),
    passed: failures.length === 0 && p95 <= TARGET_MS && (withinTarget / (sorted.length || 1)) >= TARGET_RATIO,
  };
}

// Seeds 1 quiz with 10 questions and `studentCount` in-progress attempts.
async function seedQuizAndAttempts({ studentCount = 100, questionCount = 10, runId }) {
  const creatorId = new mongoose.Types.ObjectId();
  const questionsBatch = [];
  const questionIds = [];

  for (let i = 0; i < questionCount; i++) {
    const qid = new mongoose.Types.ObjectId();
    questionIds.push(qid);
    questionsBatch.push({
      _id: qid,
      text: `Performance evaluation question #${i + 1} (${runId})`,
      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      correctIndex: i % 4,
      topic: 'Algorithms',
      difficulty: 'Medium',
      creatorId,
      perfRunId: runId,
    });
  }
  await Question.collection.insertMany(questionsBatch);

  const quizId = new mongoose.Types.ObjectId();
  const quiz = await Quiz.create({
    _id: quizId,
    title: `Concurrent Quiz Benchmark (${runId})`,
    timeLimitMinutes: 30,
    questionIds,
    creatorId,
    status: 'published',
    publishedAt: new Date(),
    perfRunId: runId,
  });

  const now = Date.now();
  const attempts = [];
  const studentTokens = [];

  // Build predefined answers where students answer questions
  const answers = {};
  for (let i = 0; i < questionIds.length; i++) {
    answers[questionIds[i].toString()] = i % 4; // correct answer
  }

  for (let s = 0; s < studentCount; s++) {
    const studentId = new mongoose.Types.ObjectId();
    const attemptId = new mongoose.Types.ObjectId();
    const token = signToken({ sub: studentId.toString(), role: 'student' });

    attempts.push({
      _id: attemptId,
      quizId,
      studentId,
      startedAt: new Date(now - 60_000),
      expiresAt: new Date(now + 1_800_000),
      status: 'in_progress',
      answers,
      perfRunId: runId,
    });

    studentTokens.push({
      attemptId: attemptId.toString(),
      token,
    });
  }

  await QuizAttempt.collection.insertMany(attempts);

  return { quiz, questionIds, studentTokens };
}

async function removeSeeded(runId) {
  await Promise.all([
    Question.collection.deleteMany({ perfRunId: runId }),
    Quiz.collection.deleteMany({ perfRunId: runId }),
    QuizAttempt.collection.deleteMany({ perfRunId: runId }),
  ]);
}

// Executes all submissions simultaneously across all student tokens
async function runSubmissions({ baseUrl, studentTokens }) {
  const durations = [];
  const failures = [];
  let totalBytes = 0;

  // Launch all submissions concurrently
  await Promise.all(
    studentTokens.map(async ({ attemptId, token }) => {
      const startedAt = process.hrtime.bigint();
      try {
        const response = await fetch(`${baseUrl}/api/quizzes/attempts/${attemptId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        const bodyText = await response.text();
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        durations.push(durationMs);
        totalBytes += Buffer.byteLength(bodyText);

        if (response.status !== 200) {
          failures.push({ attemptId, status: response.status, body: bodyText });
        } else {
          const json = JSON.parse(bodyText);
          if (!json.attempt || !json.attempt.result) {
            failures.push({ attemptId, status: 200, message: 'Result payload missing' });
          }
        }
      } catch (err) {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        durations.push(durationMs);
        failures.push({ attemptId, error: err.message });
      }
    })
  );

  return summarise(durations, failures, totalBytes);
}

async function main() {
  const app = require('../app');
  const uri = process.env.PERF_MONGO_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/studyplatform';
  const studentCount = Number(process.env.PERF_SUBMISSIONS || 100);
  const runId = `perf-submit-${Date.now()}`;

  await mongoose.connect(uri);
  await Promise.all([Quiz.init(), Question.init(), QuizAttempt.init()]);

  console.log(`Seeding 1 quiz and ${studentCount} concurrent student attempts...`);
  const { studentTokens } = await seedQuizAndAttempts({ studentCount, runId });

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));

  try {
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    console.log(`Executing ${studentCount} simultaneous quiz submissions against ${baseUrl}...`);

    const result = await runSubmissions({ baseUrl, studentTokens });

    const output = {
      testCase: 'TC-Perf-02',
      requirement: 'CSQ-NF-002',
      date: new Date().toISOString(),
      node: process.version,
      simultaneousSubmissions: studentCount,
      targetMs: TARGET_MS,
      ...result,
    };

    console.log(JSON.stringify(output, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } finally {
    await new Promise(resolve => server.close(resolve));
    await removeSeeded(runId);
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Quiz submit performance test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  TARGET_MS,
  TARGET_RATIO,
  percentile,
  summarise,
  seedQuizAndAttempts,
  removeSeeded,
  runSubmissions,
};
