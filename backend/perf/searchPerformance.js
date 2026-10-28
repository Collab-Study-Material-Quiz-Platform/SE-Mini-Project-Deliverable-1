// TC-Perf-01 (CSQ-NF-001): 95% of material searches must return within 2 s with 10,000 materials stored.
// Run with `npm run perf:search`; the same functions are used by tests/searchPerformance.integration.test.js.
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');

const TARGET_MS = 2000;
const TARGET_RATIO = 0.95;

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'History', 'Geography', 'Economics',
  'English', 'Statistics', 'Accounting', 'Psychology', 'Philosophy', 'Electronics', 'Mechanics', 'Sociology', 'Law',
  'Medicine', 'Architecture', 'Music'];
const TOPICS = ['Algebra', 'Geometry', 'Calculus', 'Optics', 'Thermodynamics', 'Organic', 'Genetics', 'Algorithms',
  'Databases', 'Networks', 'Revolution', 'Climate', 'Markets', 'Grammar', 'Probability', 'Auditing', 'Cognition',
  'Ethics', 'Circuits', 'Dynamics', 'Kinematics', 'Ecology', 'Cells', 'Inflation', 'Poetry', 'Contracts', 'Anatomy',
  'Design', 'Harmony', 'Statics', 'Vectors', 'Matrices', 'Electrostatics', 'Magnetism', 'Waves', 'Acids', 'Evolution',
  'Compilers', 'Security', 'Empires', 'Rivers', 'Trade', 'Essays', 'Regression', 'Taxation', 'Memory', 'Logic',
  'Signals', 'Fluids', 'Rhythm'];
const KINDS = ['Lecture notes', 'Revision guide', 'Question paper', 'Lab manual', 'Summary sheet', 'Worked examples',
  'Slides', 'Handbook', 'Cheat sheet', 'Assignment solutions'];

function pick(list, index) {
  return list[index % list.length];
}

// Inserts `count` materials directly through the driver (no files are needed for searching).
async function seedMaterials(Material, count, runId, ownerId = new mongoose.Types.ObjectId()) {
  const now = Date.now();
  const batchSize = 1000;
  for (let start = 0; start < count; start += batchSize) {
    const batch = [];
    for (let i = start; i < Math.min(count, start + batchSize); i += 1) {
      const subject = pick(SUBJECTS, i);
      const topic = pick(TOPICS, Math.floor(i / SUBJECTS.length) + i);
      const createdAt = new Date(now - (count - i) * 60 * 1000);
      batch.push({
        title: `${pick(KINDS, i * 7)} ${topic} ${subject} ${i}`,
        subject,
        topic,
        subjectKey: subject.toLowerCase(),
        topicKey: topic.toLowerCase(),
        originalName: `material-${i}.pdf`,
        storagePath: crypto.randomUUID(),
        mimeType: 'application/pdf',
        sizeBytes: 50000 + (i % 1000) * 1000,
        ownerId,
        downloadCount: i % 50,
        createdAt,
        updatedAt: createdAt,
        perfRunId: runId,
      });
    }
    await Material.collection.insertMany(batch, { ordered: false });
  }
}

async function removeSeededMaterials(Material, runId) {
  await Material.collection.deleteMany({ perfRunId: runId });
}

// A mix of keyword, subject, topic and combined searches over several result pages.
function buildSearches(count) {
  const searches = [];
  for (let i = 0; i < count; i += 1) {
    const params = {};
    switch (i % 6) {
      case 0: params.q = pick(TOPICS, i * 3); break;
      case 1: params.q = pick(KINDS, i).split(' ')[0]; params.subject = pick(SUBJECTS, i); break;
      case 2: params.subject = pick(SUBJECTS, i * 5); break;
      case 3: params.topic = pick(TOPICS, i * 11); break;
      case 4: params.subject = pick(SUBJECTS, i); params.topic = pick(TOPICS, i * 2); break;
      default: params.q = `${pick(TOPICS, i)} ${pick(SUBJECTS, i)}`; break;
    }
    params.page = String((i % 3) + 1);
    searches.push(params);
  }
  return searches;
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedValues.length);
  return sortedValues[Math.min(sortedValues.length, Math.max(1, rank)) - 1];
}

// Sends the searches with `concurrency` requests in flight and records each end-to-end response time.
async function runSearches({ baseUrl, token, searchCount = 200, concurrency = 10 }) {
  const searches = buildSearches(searchCount);
  const durations = [];
  const failures = [];
  let totalBytes = 0;
  let next = 0;

  async function worker() {
    while (next < searches.length) {
      const params = searches[next];
      next += 1;
      const startedAt = process.hrtime.bigint();
      const response = await fetch(`${baseUrl}/api/materials?${new URLSearchParams(params)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await response.text();
      durations.push(Number(process.hrtime.bigint() - startedAt) / 1e6);
      totalBytes += Buffer.byteLength(body);
      if (response.status !== 200) failures.push({ params, status: response.status });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return summarise(durations, failures, totalBytes);
}

function summarise(durations, failures, totalBytes) {
  const sorted = durations.slice().sort((a, b) => a - b);
  const withinTarget = sorted.filter(ms => ms <= TARGET_MS).length;
  const round = value => Math.round(value * 10) / 10;
  const p95 = percentile(sorted, 95);
  return {
    searches: sorted.length,
    failures,
    meanMs: round(sorted.reduce((sum, ms) => sum + ms, 0) / (sorted.length || 1)),
    p50Ms: round(percentile(sorted, 50)),
    p95Ms: round(p95),
    p99Ms: round(percentile(sorted, 99)),
    maxMs: round(sorted[sorted.length - 1] || 0),
    withinTargetPercent: round((withinTarget / (sorted.length || 1)) * 100),
    meanResponseBytes: Math.round(totalBytes / (sorted.length || 1)),
    passed: failures.length === 0 && p95 <= TARGET_MS && withinTarget / (sorted.length || 1) >= TARGET_RATIO,
  };
}

async function main() {
  const { signToken } = require('../utils/authToken');
  const Material = require('../models/Material');
  const app = require('../app');
  const uri = process.env.PERF_MONGO_URI || 'mongodb://127.0.0.1:27017/studyplatform_perf';
  const materialCount = Number(process.env.PERF_MATERIALS || 10000);
  const searchCount = Number(process.env.PERF_SEARCHES || 200);
  const concurrency = Number(process.env.PERF_CONCURRENCY || 10);
  const runId = `perf-${Date.now()}`;

  await mongoose.connect(uri);
  await Material.init();
  await seedMaterials(Material, materialCount, runId);
  const stored = await Material.estimatedDocumentCount();
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));

  try {
    const token = signToken({ sub: new mongoose.Types.ObjectId().toString(), role: 'student' });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    await runSearches({ baseUrl, token, searchCount: 10, concurrency: 1 }); // warm-up, not measured
    const result = await runSearches({ baseUrl, token, searchCount, concurrency });
    // Added time to transfer the average response body over the SRS reference 10 Mbps connection.
    const transferMs = Math.round(((result.meanResponseBytes * 8) / 10e6) * 1000 * 10) / 10;
    console.log(JSON.stringify({
      testCase: 'TC-Perf-01',
      requirement: 'CSQ-NF-001',
      date: new Date().toISOString(),
      node: process.version,
      materialsStored: stored,
      concurrency,
      targetMs: TARGET_MS,
      ...result,
      estimatedTransferMsAt10Mbps: transferMs,
    }, null, 2));
    process.exitCode = result.passed ? 0 : 1;
  } finally {
    await new Promise(resolve => server.close(resolve));
    await removeSeededMaterials(Material, runId);
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Search performance test failed:', error);
    process.exit(1);
  });
}

module.exports = { TARGET_MS, seedMaterials, removeSeededMaterials, buildSearches, runSearches, percentile };
