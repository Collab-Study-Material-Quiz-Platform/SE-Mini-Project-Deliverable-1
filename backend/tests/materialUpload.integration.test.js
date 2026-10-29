const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'csq-uploads-'));

const test = require('node:test');
const assert = require('node:assert/strict');
const Material = require('../models/Material');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');
const { makePdf, makeDocx, makePptx, makeExecutable } = require('./helpers/documents');

const MB = 1024 * 1024;
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
  if (api) await api.stop();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

function storedFiles() {
  return fs.existsSync(process.env.UPLOAD_DIR) ? fs.readdirSync(process.env.UPLOAD_DIR) : [];
}

function uploadForm({ data = makePdf(), fileName = 'notes.pdf', title = 'Linear Algebra Notes', subject = 'Mathematics', topic = 'Algebra' } = {}) {
  const form = new FormData();
  if (title != null) form.append('title', title);
  if (subject != null) form.append('subject', subject);
  if (topic != null) form.append('topic', topic);
  if (data) form.append('file', new Blob([data]), fileName);
  return form;
}

async function upload(form, headers = contributor.headers) {
  const response = await fetch(`${api.baseUrl}/api/materials`, { method: 'POST', headers, body: form });
  return { status: response.status, body: await response.json() };
}

test('a contributor uploads a PDF with title, subject and topic', { skip: !canUseDatabase }, async () => {
  const data = makePdf(4096);
  const { status, body } = await upload(uploadForm({ data }));

  assert.equal(status, 201);
  assert.equal(body.message, 'Upload successful');
  assert.equal(body.material.title, 'Linear Algebra Notes');
  assert.equal(body.material.subject, 'Mathematics');
  assert.equal(body.material.topic, 'Algebra');
  assert.equal(body.material.originalName, 'notes.pdf');
  assert.equal(body.material.mimeType, 'application/pdf');
  assert.equal(body.material.sizeBytes, data.length);
  assert.equal(body.material.downloadCount, 0);
  assert.equal(Object.hasOwn(body.material, 'storagePath'), false);

  const saved = await Material.findById(body.material.id).select('+storagePath');
  assert.equal(saved.ownerId.toString(), contributor.user._id.toString());
  const storedPath = path.join(process.env.UPLOAD_DIR, saved.storagePath);
  assert.deepEqual(fs.readFileSync(storedPath), data);
});

test('DOCX and PPTX files are accepted', { skip: !canUseDatabase }, async () => {
  const docx = await upload(uploadForm({ data: makeDocx(), fileName: 'essay.docx' }));
  assert.equal(docx.status, 201);
  assert.equal(docx.body.material.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  const pptx = await upload(uploadForm({ data: makePptx(), fileName: 'lecture.pptx' }));
  assert.equal(pptx.status, 201);
  assert.equal(pptx.body.material.mimeType, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
});

test('non-ASCII file names are kept intact', { skip: !canUseDatabase }, async () => {
  const { status, body } = await upload(uploadForm({ fileName: 'résumé notes ñ.pdf' }));
  assert.equal(status, 201);
  assert.equal(body.material.originalName, 'résumé notes ñ.pdf');
});

test('a valid 20 MB PDF is stored and confirmed within 10 seconds', { skip: !canUseDatabase }, async () => {
  const data = makePdf(20 * MB);
  const startedAt = Date.now();
  const { status, body } = await upload(uploadForm({ data, fileName: 'large.pdf' }));
  const elapsed = Date.now() - startedAt;

  assert.equal(status, 201);
  assert.equal(body.material.sizeBytes, 20 * MB);
  assert.ok(elapsed < 10000, `upload took ${elapsed}ms`);
});

test('a 21 MB PDF is rejected with "Invalid file" and nothing is kept', { skip: !canUseDatabase }, async () => {
  const before = storedFiles().length;
  const { status, body } = await upload(uploadForm({ data: makePdf(21 * MB), fileName: 'huge.pdf' }));
  assert.equal(status, 400);
  assert.equal(body.message, 'Invalid file');
  assert.equal(storedFiles().length, before);
});

test('an executable renamed to .pdf is rejected and its temporary file is deleted', { skip: !canUseDatabase }, async () => {
  const before = storedFiles().length;
  const { status, body } = await upload(uploadForm({ data: makeExecutable(), fileName: 'setup.pdf' }));
  assert.equal(status, 400);
  assert.equal(body.message, 'Invalid file');
  assert.equal(storedFiles().length, before);
});

test('unsupported formats and requests without a file are rejected', { skip: !canUseDatabase }, async () => {
  const text = await upload(uploadForm({ data: Buffer.from('plain text'), fileName: 'notes.txt' }));
  assert.equal(text.status, 400);
  assert.equal(text.body.message, 'Invalid file');
  const missing = await upload(uploadForm({ data: null }));
  assert.equal(missing.status, 400);
  assert.equal(missing.body.message, 'Invalid file');
});

test('title is accepted up to 100 characters and rejected beyond that', { skip: !canUseDatabase }, async () => {
  const accepted = await upload(uploadForm({ title: 'T'.repeat(100) }));
  assert.equal(accepted.status, 201);
  const before = storedFiles().length;
  const rejected = await upload(uploadForm({ title: 'T'.repeat(101) }));
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.message, 'Title must not exceed 100 characters');
  assert.equal(storedFiles().length, before);
});

test('title, subject and topic are required', { skip: !canUseDatabase }, async () => {
  assert.equal((await upload(uploadForm({ title: '  ' }))).body.message, 'Title is required');
  assert.equal((await upload(uploadForm({ subject: null }))).body.message, 'Subject is required');
  assert.equal((await upload(uploadForm({ topic: '' }))).body.message, 'Topic is required');
});

test('only contributors can upload material', { skip: !canUseDatabase }, async () => {
  const before = storedFiles().length;
  const asStudent = await upload(uploadForm(), student.headers);
  assert.equal(asStudent.status, 403);
  assert.equal(asStudent.body.message, 'Access denied');
  const admin = await createUserWithToken('admin');
  assert.equal((await upload(uploadForm(), admin.headers)).status, 403);
  assert.equal((await upload(uploadForm(), {})).status, 401);
  assert.equal(storedFiles().length, before);
});
