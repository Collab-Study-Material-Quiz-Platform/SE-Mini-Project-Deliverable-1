const test = require('node:test');
const assert = require('node:assert/strict');
const Material = require('../models/Material');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');
const { TARGET_MS, seedMaterials, removeSeededMaterials, buildSearches, runSearches, percentile } = require('../perf/searchPerformance');

const runId = `perf-test-${process.pid}-${Date.now()}`;
let api;
let student;

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Material]);
  student = await createUserWithToken('student');
  await seedMaterials(Material, 10000, runId);
});

test.after(async () => {
  if (!api) return;
  await removeSeededMaterials(Material, runId);
  await api.stop();
});

test('percentile uses the nearest-rank method', () => {
  const values = Array.from({ length: 200 }, (_, i) => i + 1);
  assert.equal(percentile(values, 95), 190);
  assert.equal(percentile(values, 50), 100);
  assert.equal(percentile([], 95), 0);
});

test('the search mix covers keyword, subject, topic and combined searches', () => {
  const searches = buildSearches(200);
  assert.equal(searches.length, 200);
  assert.ok(searches.some(params => params.q && !params.subject));
  assert.ok(searches.some(params => params.q && params.subject));
  assert.ok(searches.some(params => params.subject && !params.q && !params.topic));
  assert.ok(searches.some(params => params.topic && !params.q && !params.subject));
  assert.ok(searches.some(params => params.subject && params.topic));
});

test('TC-Perf-01: 95th percentile of 200 searches over 10,000 materials is within 2 s', { skip: !canUseDatabase, timeout: 120000 }, async () => {
  assert.ok(await Material.countDocuments({ perfRunId: runId }) === 10000);
  const result = await runSearches({ baseUrl: api.baseUrl, token: student.token, searchCount: 200, concurrency: 10 });

  assert.equal(result.searches, 200);
  assert.deepEqual(result.failures, []);
  assert.ok(result.p95Ms <= TARGET_MS, `p95 was ${result.p95Ms}ms`);
  assert.ok(result.withinTargetPercent >= 95, `${result.withinTargetPercent}% within target`);
  assert.equal(result.passed, true);
});
