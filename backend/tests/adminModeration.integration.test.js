require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../app');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const Material = require('../models/Material');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { signToken } = require('../utils/authToken');

const canUseDatabase = Boolean(process.env.MONGO_URI);
let server;
let baseUrl;
let emailCounter = 0;

function testEmail() {
  emailCounter += 1;
  return `csq-admin-${process.pid}-${Date.now()}-${emailCounter}@example.test`;
}

async function createUserWithToken(role) {
  emailCounter += 1;
  const user = await User.create({
    name: `Test ${role}`,
    email: `csq-admin-${role}-${process.pid}-${Date.now()}-${emailCounter}@example.test`,
    passwordHash: await bcrypt.hash('ExamplePassword1!', 10),
    role,
  });
  const token = signToken({ sub: user._id.toString(), role: user.role });
  return { user, token, headers: { Authorization: `Bearer ${token}` } };
}

async function createQuizWithQuestions(creator) {
  const questionIds = [];
  for (let i = 0; i < 5; i++) {
    const q = await Question.create({
      text: `Admin-mod question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      topic: 'Algebra',
      difficulty: 'Easy',
      ownerId: creator.user._id,
    });
    questionIds.push(q._id);
  }
  const quiz = await Quiz.create({
    title: 'Quiz for admin moderation',
    timeLimitMinutes: 10,
    questionIds,
    creatorId: creator.user._id,
    status: 'published',
    publishedAt: new Date(),
  });
  return quiz;
}

// Minimal valid PDF bytes for material creation.
const PDF_BYTES = Buffer.from([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
  0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
  0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67,
  0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20, 0x31, 0x20, 0x52, 0x2f, 0x3e, 0x0a,
  0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
  0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,
  0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
]);

test.before(async () => {
  if (!canUseDatabase) return;
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  await Quiz.init();
  await Question.init();
  await Material.init();
  await AuditLog.init();
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

// ── Admin removes another Contributor's quiz ──────────────────────────────────

test('an admin can remove another contributor’s quiz', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const admin = await createUserWithToken('admin');
  const quiz = await createQuizWithQuestions(contributor);

  const response = await fetch(`${baseUrl}/api/quizzes/${quiz._id}`, {
    method: 'DELETE',
    headers: admin.headers,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message, 'Quiz deleted');

  // Soft delete: status is 'removed', document still exists.
  const updated = await Quiz.findById(quiz._id).lean();
  assert.equal(updated.status, 'removed');
});

// ── After admin quiz deletion, quiz is gone for Students ───────────────────────

test('after admin deletes a quiz it is no longer listed for students', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const admin = await createUserWithToken('admin');
  const student = await createUserWithToken('student');
  const quiz = await createQuizWithQuestions(contributor);

  // Confirm it appears before deletion.
  const before = await fetch(`${baseUrl}/api/quizzes/published`, { headers: student.headers });
  const beforeBody = await before.json();
  assert.ok(beforeBody.quizzes.some(q => q.id === quiz._id.toString()), 'quiz should be listed before deletion');

  await fetch(`${baseUrl}/api/quizzes/${quiz._id}`, { method: 'DELETE', headers: admin.headers });

  const after = await fetch(`${baseUrl}/api/quizzes/published`, { headers: student.headers });
  const afterBody = await after.json();
  assert.ok(!afterBody.quizzes.some(q => q.id === quiz._id.toString()), 'quiz should not be listed after admin deletion');
});

// ── Admin removes a material ─────────────────────────────────────────────────────

test('an admin can remove any material', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const admin = await createUserWithToken('admin');

  // Upload a material as the contributor.
  const formData = new FormData();
  formData.append('file', new Blob([PDF_BYTES]), 'admin-mod.pdf');
  formData.append('title', 'Admin moderation test');
  formData.append('subject', 'Physics');
  formData.append('topic', 'Mechanics');

  const uploadRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: contributor.headers,
    body: formData,
  });
  assert.equal(uploadRes.status, 201);
  const materialId = (await uploadRes.json()).material.id;

  // Admin deletes the material.
  const deleteRes = await fetch(`${baseUrl}/api/materials/${materialId}`, {
    method: 'DELETE',
    headers: admin.headers,
  });
  assert.equal(deleteRes.status, 200);
  assert.equal((await deleteRes.json()).message, 'Material deleted');

  // The record is gone from the database.
  const stillExists = await Material.findById(materialId).lean();
  assert.equal(stillExists, null, 'material record should be deleted');
});

// ── After admin material deletion, it is gone from search ───────────────────────

test('after admin deletes a material it no longer appears in search', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const admin = await createUserWithToken('admin');

  const formData = new FormData();
  formData.append('file', new Blob([PDF_BYTES]), 'search-gone.pdf');
  formData.append('title', 'Search will not find this');
  formData.append('subject', 'Biology');
  formData.append('topic', 'Genetics');

  const uploadRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: contributor.headers,
    body: formData,
  });
  const materialId = (await uploadRes.json()).material.id;

  // Confirm it appears before deletion.
  const before = await fetch(`${baseUrl}/api/materials?keyword=Search+will+not+find`, {
    headers: contributor.headers,
  });
  const beforeBody = await before.json();
  assert.ok(beforeBody.materials.some(m => m.id === materialId), 'material should be found before deletion');

  await fetch(`${baseUrl}/api/materials/${materialId}`, { method: 'DELETE', headers: admin.headers });

  // Confirm it no longer appears.
  const after = await fetch(`${baseUrl}/api/materials?keyword=Search+will+not+find`, {
    headers: contributor.headers,
  });
  const afterBody = await after.json();
  assert.ok(!afterBody.materials.some(m => m.id === materialId), 'material should not be found after deletion');
});

// ── After admin material deletion, download returns 404 ─────────────────────────

test('after admin deletes a material the download endpoint returns 404', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const admin = await createUserWithToken('admin');

  const formData = new FormData();
  formData.append('file', new Blob([PDF_BYTES]), 'download-gone.pdf');
  formData.append('title', 'Download 404 test');
  formData.append('subject', 'Chemistry');
  formData.append('topic', 'Organic');

  const uploadRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: contributor.headers,
    body: formData,
  });
  const materialId = (await uploadRes.json()).material.id;

  await fetch(`${baseUrl}/api/materials/${materialId}`, { method: 'DELETE', headers: admin.headers });

  const downloadRes = await fetch(`${baseUrl}/api/materials/${materialId}/download`, {
    headers: contributor.headers,
  });
  assert.equal(downloadRes.status, 404);
});

// ── A Contributor gets 403 deleting another contributor's material ──────────────

test('a contributor cannot delete another contributor’s material and gets 403', { skip: !canUseDatabase }, async () => {
  const owner = await createUserWithToken('contributor');
  const other = await createUserWithToken('contributor');

  const formData = new FormData();
  formData.append('file', new Blob([PDF_BYTES]), 'other-owner.pdf');
  formData.append('title', 'Not mine');
  formData.append('subject', 'History');
  formData.append('topic', 'Ancient');

  const uploadRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: owner.headers,
    body: formData,
  });
  const materialId = (await uploadRes.json()).material.id;

  const deleteRes = await fetch(`${baseUrl}/api/materials/${materialId}`, {
    method: 'DELETE',
    headers: other.headers,
  });
  assert.equal(deleteRes.status, 403);
  assert.equal((await deleteRes.json()).message, 'Access denied');
});

// ── A Student gets 403 on material delete ───────────────────────────────────────

test('a student cannot delete a material and gets 403', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const student = await createUserWithToken('student');

  const formData = new FormData();
  formData.append('file', new Blob([PDF_BYTES]), 'student-no-delete.pdf');
  formData.append('title', 'Student cannot delete');
  formData.append('subject', 'Geology');
  formData.append('topic', 'Minerals');

  const uploadRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: contributor.headers,
    body: formData,
  });
  const materialId = (await uploadRes.json()).material.id;

  const deleteRes = await fetch(`${baseUrl}/api/materials/${materialId}`, {
    method: 'DELETE',
    headers: student.headers,
  });
  assert.equal(deleteRes.status, 403);
});

// ── A missing material gets 404 ───────────────────────────────────────────────────

test('deleting a missing material returns 404', { skip: !canUseDatabase }, async () => {
  const admin = await createUserWithToken('admin');
  const fakeId = new mongoose.Types.ObjectId();
  const response = await fetch(`${baseUrl}/api/materials/${fakeId}`, {
    method: 'DELETE',
    headers: admin.headers,
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, 'Material not found');
});

// ── A missing quiz gets 404 ───────────────────────────────────────────────────────

test('deleting a missing quiz returns 404', { skip: !canUseDatabase }, async () => {
  const admin = await createUserWithToken('admin');
  const fakeId = new mongoose.Types.ObjectId();
  const response = await fetch(`${baseUrl}/api/quizzes/${fakeId}`, {
    method: 'DELETE',
    headers: admin.headers,
  });
  assert.equal(response.status, 404);
});

// ── One audit entry each ───────────────────────────────────────────────────────────

test('admin quiz deletion writes one DELETE audit entry', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const admin = await createUserWithToken('admin');
  const quiz = await createQuizWithQuestions(contributor);

  const before = await AuditLog.countDocuments({ userId: admin.user._id, action: 'DELETE', targetId: quiz._id });

  await fetch(`${baseUrl}/api/quizzes/${quiz._id}`, { method: 'DELETE', headers: admin.headers });

  const after = await AuditLog.countDocuments({ userId: admin.user._id, action: 'DELETE', targetId: quiz._id });
  assert.equal(after - before, 1, 'exactly one DELETE audit entry for the quiz');
});

test('admin material deletion writes one DELETE audit entry', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const admin = await createUserWithToken('admin');

  const formData = new FormData();
  formData.append('file', new Blob([PDF_BYTES]), 'audit-test.pdf');
  formData.append('title', 'Audit entry test');
  formData.append('subject', 'Astronomy');
  formData.append('topic', 'Stars');

  const uploadRes = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers: contributor.headers,
    body: formData,
  });
  const materialId = (await uploadRes.json()).material.id;

  const before = await AuditLog.countDocuments({ userId: admin.user._id, action: 'DELETE' });

  await fetch(`${baseUrl}/api/materials/${materialId}`, { method: 'DELETE', headers: admin.headers });

  const after = await AuditLog.countDocuments({ userId: admin.user._id, action: 'DELETE' });
  assert.equal(after - before, 1, 'exactly one DELETE audit entry for the material');
});
