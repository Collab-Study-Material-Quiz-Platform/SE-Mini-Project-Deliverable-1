const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'csq-download-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Material = require('../models/Material');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');
const { makePdf } = require('./helpers/documents');

let api;
let contributor;
let student;

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([Material]);
  contributor = await createUserWithToken('contributor');
  student = await createUserWithToken('student');
});

test.after(async () => {
  if (api) {
    await Material.deleteMany({ ownerId: contributor.user._id });
    await api.stop();
  }
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

async function uploadPdf(data, fileName = 'chapter one.pdf') {
  const form = new FormData();
  form.append('title', 'Downloadable notes');
  form.append('subject', 'Chemistry');
  form.append('topic', 'Bonding');
  form.append('file', new Blob([data]), fileName);
  const response = await fetch(`${api.baseUrl}/api/materials`, { method: 'POST', headers: contributor.headers, body: form });
  assert.equal(response.status, 201);
  return (await response.json()).material;
}

function download(id, headers = student.headers) {
  return fetch(`${api.baseUrl}/api/materials/${id}/download`, { headers });
}

async function downloadCount(id) {
  return (await Material.findById(id)).downloadCount;
}

test('a logged-in user downloads the exact stored file', { skip: !canUseDatabase }, async () => {
  const data = makePdf(256 * 1024);
  const material = await uploadPdf(data);

  const response = await download(material.id);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.match(response.headers.get('content-disposition'), /^attachment;.*chapter one\.pdf/);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.length, material.sizeBytes);
  assert.deepEqual(body, data);
});

test('each download increases the download count by exactly 1', { skip: !canUseDatabase }, async () => {
  const material = await uploadPdf(makePdf(2048));
  assert.equal(await downloadCount(material.id), 0);

  await (await download(material.id)).arrayBuffer();
  assert.equal(await downloadCount(material.id), 1);

  await (await download(material.id, contributor.headers)).arrayBuffer();
  assert.equal(await downloadCount(material.id), 2);

  const search = await fetch(`${api.baseUrl}/api/materials?topic=Bonding`, { headers: student.headers });
  const listed = (await search.json()).materials.find(item => item.id === material.id);
  assert.equal(listed.downloadCount, 2);
});

test('concurrent downloads are all counted', { skip: !canUseDatabase }, async () => {
  const material = await uploadPdf(makePdf(2048));
  const responses = await Promise.all(Array.from({ length: 5 }, () => download(material.id)));
  await Promise.all(responses.map(response => response.arrayBuffer()));
  assert.equal(await downloadCount(material.id), 5);
});

test('unknown or malformed material ids return 404', { skip: !canUseDatabase }, async () => {
  const unknown = await download(new mongoose.Types.ObjectId().toString());
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).message, 'Material not found');
  assert.equal((await download('not-an-id')).status, 404);
});

test('downloading requires a logged-in user', { skip: !canUseDatabase }, async () => {
  const material = await uploadPdf(makePdf(1024));
  assert.equal((await download(material.id, {})).status, 401);
  assert.equal(await downloadCount(material.id), 0);
});
