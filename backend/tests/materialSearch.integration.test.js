const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'csq-search-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const Material = require('../models/Material');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');
const { makePdf } = require('./helpers/documents');

// A unique word per run keeps these searches independent of data left by earlier runs.
const runId = `run${process.pid}x${Date.now()}`;
const subject = `Physics ${runId}`;
let api;
let contributor;
let student;
let created = [];

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Material]);
  contributor = await createUserWithToken('contributor');
  student = await createUserWithToken('student');

  // 12 materials created one after another, so a later index means a newer material.
  for (let i = 0; i < 12; i += 1) {
    created.push(await Material.create({
      title: `${runId} Lecture ${i}`,
      subject,
      topic: i % 2 === 0 ? 'Optics' : 'Mechanics',
      originalName: `lecture-${i}.pdf`,
      storagePath: `missing-${i}`,
      mimeType: 'application/pdf',
      sizeBytes: 1000 + i,
      ownerId: contributor.user._id,
    }));
  }
});

test.after(async () => {
  if (api) {
    await Material.deleteMany({ ownerId: contributor.user._id });
    await api.stop();
  }
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

async function search(params, headers = student.headers) {
  const response = await fetch(`${api.baseUrl}/api/materials?${new URLSearchParams(params)}`, { headers });
  return { status: response.status, body: await response.json() };
}

test('a keyword search returns 10 results per page, newest first', { skip: !canUseDatabase }, async () => {
  const first = await search({ q: runId });
  assert.equal(first.status, 200);
  assert.equal(first.body.total, 12);
  assert.equal(first.body.pageSize, 10);
  assert.equal(first.body.totalPages, 2);
  assert.equal(first.body.materials.length, 10);
  const newestFirst = created.slice().reverse().map(material => material._id.toString());
  assert.deepEqual(first.body.materials.map(material => material.id), newestFirst.slice(0, 10));

  const second = await search({ q: runId, page: '2' });
  assert.equal(second.body.page, 2);
  assert.deepEqual(second.body.materials.map(material => material.id), newestFirst.slice(10));
});

test('results contain list fields only and never the storage path', { skip: !canUseDatabase }, async () => {
  const { body } = await search({ q: runId });
  const [material] = body.materials;
  assert.deepEqual(Object.keys(material).sort(), [
    'createdAt', 'downloadCount', 'id', 'mimeType', 'originalName', 'ownerId', 'sizeBytes', 'subject', 'title', 'topic',
  ]);
});

test('search filters by subject, by topic and by both', { skip: !canUseDatabase }, async () => {
  const bySubject = await search({ subject: subject.toUpperCase() });
  assert.equal(bySubject.body.total, 12);

  const byTopic = await search({ q: runId, topic: 'optics' });
  assert.equal(byTopic.body.total, 6);
  assert.ok(byTopic.body.materials.every(material => material.topic === 'Optics'));

  const both = await search({ subject, topic: 'Mechanics' });
  assert.equal(both.body.total, 6);
  assert.ok(both.body.materials.every(material => material.topic === 'Mechanics' && material.subject === subject));
});

test('a search with no matches reports "No materials found"', { skip: !canUseDatabase }, async () => {
  const { status, body } = await search({ q: `nothing${runId}` });
  assert.equal(status, 200);
  assert.equal(body.total, 0);
  assert.deepEqual(body.materials, []);
  assert.equal(body.message, 'No materials found');
});

test('an uploaded material appears in search results', { skip: !canUseDatabase }, async () => {
  const form = new FormData();
  form.append('title', `Uploaded ${runId} handout`);
  form.append('subject', subject);
  form.append('topic', 'Waves');
  form.append('file', new Blob([makePdf()]), 'handout.pdf');
  const uploaded = await fetch(`${api.baseUrl}/api/materials`, { method: 'POST', headers: contributor.headers, body: form });
  assert.equal(uploaded.status, 201);
  const { material } = await uploaded.json();

  const { body } = await search({ q: runId, topic: 'Waves' });
  assert.equal(body.total, 1);
  assert.equal(body.materials[0].id, material.id);
});

test('every logged-in role can search and anonymous users cannot', { skip: !canUseDatabase }, async () => {
  const admin = await createUserWithToken('admin');
  assert.equal((await search({ q: runId }, contributor.headers)).status, 200);
  assert.equal((await search({ q: runId }, admin.headers)).status, 200);
  assert.equal((await search({ q: runId }, {})).status, 401);
});

test('an invalid page number is rejected', { skip: !canUseDatabase }, async () => {
  const { status, body } = await search({ q: runId, page: '0' });
  assert.equal(status, 400);
  assert.equal(body.message, 'Page must be a positive whole number');
});
