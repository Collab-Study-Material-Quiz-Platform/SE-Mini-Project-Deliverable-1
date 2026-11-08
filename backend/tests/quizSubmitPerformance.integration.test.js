require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const Question = require('../models/Question');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const { canUseDatabase, startTestServer } = require('./helpers/testServer');
const {
  TARGET_MS,
  percentile,
  summarise,
  seedQuizAndAttempts,
  removeSeeded,
  runSubmissions,
} = require('../perf/quizSubmitPerformance');

const runId = `perf-test-${process.pid}-${Date.now()}`;
let api;
let studentTokens;

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Question, Quiz, QuizAttempt]);
  const seeded = await seedQuizAndAttempts({ studentCount: 100, questionCount: 10, runId });
  studentTokens = seeded.studentTokens;
});

test.after(async () => {
  if (!api) return;
  await removeSeeded(runId);
  await api.stop();
});

test('percentile calculation follows nearest-rank standard', () => {
  const vals = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(vals, 50), 50);
  assert.equal(percentile(vals, 95), 95);
  assert.equal(percentile(vals, 99), 99);
  assert.equal(percentile([], 95), 0);
});

test('summarise correctly reports pass criteria and latency metrics', () => {
  const durations = Array.from({ length: 100 }, (_, i) => i * 10); // 0 to 990 ms
  const summary = summarise(durations, [], 1000);
  assert.equal(summary.submissions, 100);
  assert.equal(summary.failures.length, 0);
  assert.ok(summary.p95Ms <= TARGET_MS);
  assert.equal(summary.withinTargetPercent, 100);
  assert.equal(summary.passed, true);
});

test('TC-Perf-02: 100 simultaneous student submissions return results within 3 s for at least 95%', { skip: !canUseDatabase, timeout: 120000 }, async () => {
  assert.equal(studentTokens.length, 100, 'must have 100 prepared student attempts');

  const result = await runSubmissions({
    baseUrl: api.baseUrl,
    studentTokens,
  });

  assert.equal(result.submissions, 100);
  assert.deepEqual(result.failures, [], 'there should be 0 failed submissions');
  assert.ok(result.p95Ms <= TARGET_MS, `p95 was ${result.p95Ms} ms, expected <= ${TARGET_MS} ms`);
  assert.ok(result.withinTargetPercent >= 95, `within target ratio was ${result.withinTargetPercent}%, expected >= 95%`);
  assert.equal(result.passed, true, 'TC-Perf-02 verification passed');
});
