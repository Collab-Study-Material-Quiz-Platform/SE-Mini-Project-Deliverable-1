require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');
const Question = require('../models/Question');
const AuditLog = require('../models/AuditLog');
const { signToken } = require('../utils/authToken');

const canUseDatabase = Boolean(process.env.MONGO_URI);
let server;
let baseUrl;
let emailCounter = 0;

function testEmail() {
  emailCounter += 1;
  return `csq-audit-${process.pid}-${Date.now()}-${emailCounter}@example.test`;
}

test.before(async () => {
  if (!canUseDatabase) return;
  await mongoose.connect(process.env.MONGO_URI);
  await User.init();
  await Question.init();
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

/**
 * Helper: count audit entries matching a filter.
 */
async function countAuditEntries(filter) {
  return AuditLog.countDocuments(filter);
}

/**
 * Helper: find all audit entries matching a filter, sorted newest-first.
 */
async function findAuditEntries(filter) {
  return AuditLog.find(filter).sort({ timestamp: -1 }).lean();
}

// ── LOGIN_SUCCESS ─────────────────────────────────────────────────────────────

test('a successful login creates exactly one LOGIN_SUCCESS entry', { skip: !canUseDatabase }, async () => {
  const email = testEmail();
  const user = await User.create({
    name: 'Audit Login User',
    email,
    passwordHash: await bcrypt.hash('ExamplePassword1!', 10),
    role: 'student',
  });

  const before = await countAuditEntries({ userId: user._id, action: 'LOGIN_SUCCESS' });

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ExamplePassword1!' }),
  });
  assert.equal(response.status, 200);

  const after = await countAuditEntries({ userId: user._id, action: 'LOGIN_SUCCESS' });
  assert.equal(after - before, 1, 'exactly one LOGIN_SUCCESS entry should be created');

  const entries = await findAuditEntries({ userId: user._id, action: 'LOGIN_SUCCESS' });
  const entry = entries[0];
  assert.ok(entry.timestamp, 'entry must have a timestamp');
  assert.equal(typeof entry.timestamp, 'object'); // Date object from lean() is... actually lean returns plain objects
});

// ── LOGIN_FAILED (wrong password) ───────────────────────────────────────────

test('a wrong password creates exactly one LOGIN_FAILED entry with the matched user id', { skip: !canUseDatabase }, async () => {
  const email = testEmail();
  const user = await User.create({
    name: 'Audit Fail User',
    email,
    passwordHash: await bcrypt.hash('ExamplePassword1!', 10),
    role: 'student',
  });

  const before = await countAuditEntries({ userId: user._id, action: 'LOGIN_FAILED' });

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'WrongPassword1!' }),
  });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.message, 'Invalid email or password');

  const after = await countAuditEntries({ userId: user._id, action: 'LOGIN_FAILED' });
  assert.equal(after - before, 1, 'exactly one LOGIN_FAILED entry should be created');
});

// ── LOGIN_FAILED (unknown email → userId null) ───────────────────────────────

test('an unknown email creates one LOGIN_FAILED entry with null userId', { skip: !canUseDatabase }, async () => {
  const before = await countAuditEntries({ userId: null, action: 'LOGIN_FAILED' });

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent@example.test', password: 'Whatever1!' }),
  });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).message, 'Invalid email or password');

  const after = await countAuditEntries({ userId: null, action: 'LOGIN_FAILED' });
  assert.equal(after - before, 1, 'exactly one LOGIN_FAILED entry with null userId');
});

// ── UPLOAD ─────────────────────────────────────────────────────────────────────

test('a material upload creates exactly one UPLOAD entry', { skip: !canUseDatabase }, async () => {
  const { user, headers } = await createUserWithTokenHelper('contributor');

  // Minimal valid PDF content (header bytes).
  const pdfBuffer = Buffer.from([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a,
  0x31, 0x20, 0x30, 0x20, 0x6f, 0x62, 0x6a, 0x0a,
    0x3c, 0x3c, 0x2f, 0x54, 0x79, 0x70, 0x65, 0x2f, 0x43, 0x61, 0x74, 0x61, 0x6c, 0x6f, 0x67,
    0x2f, 0x50, 0x61, 0x67, 0x65, 0x73, 0x20, 0x31, 0x20, 0x52, 0x2f, 0x3e, 0x0a,
    0x65, 0x6e, 0x64, 0x6f, 0x62, 0x6a, 0x0a,
    0x74, 0x72, 0x61, 0x69, 0x6c, 0x65, 0x72, 0x0a,
    0x25, 0x25, 0x45, 0x4f, 0x46, 0x0a,
  ]);

  const formData = new FormData();
  formData.append('file', new Blob([pdfBuffer]), 'test.pdf');
  formData.append('title', 'Audit Test PDF');
  formData.append('subject', 'Mathematics');
  formData.append('topic', 'Algebra');

  const before = await countAuditEntries({ userId: user._id, action: 'UPLOAD' });

  const response = await fetch(`${baseUrl}/api/materials`, {
    method: 'POST',
    headers,
    body: formData,
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  const materialId = body.material.id;

  const after = await countAuditEntries({ userId: user._id, action: 'UPLOAD' });
  assert.equal(after - before, 1, 'exactly one UPLOAD entry should be created');

  const entries = await findAuditEntries({ userId: user._id, action: 'UPLOAD' });
  assert.equal(entries[0].targetId?.toString(), materialId, 'targetId should be the material id');
});

// ── DELETE (question) ───────────────────────────────────────────────────────────

test('deleting a question creates exactly one DELETE entry', { skip: !canUseDatabase }, async () => {
  const { user, headers } = await createUserWithTokenHelper('contributor');

  const question = await Question.create({
    text: 'What is 2 + 2?',
    options: ['1', '2', '3', '4'],
    correctIndex: 3,
    topic: 'Arithmetic',
    difficulty: 'Easy',
    ownerId: user._id,
  });

  const before = await countAuditEntries({ userId: user._id, action: 'DELETE' });

  const response = await fetch(`${baseUrl}/api/questions/${question._id}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message, 'Question deleted');

  const after = await countAuditEntries({ userId: user._id, action: 'DELETE' });
  assert.equal(after - before, 1, 'exactly one DELETE entry should be created');

  const entries = await findAuditEntries({ userId: user._id, action: 'DELETE' });
  assert.equal(entries[0].targetId?.toString(), question._id.toString(), 'targetId should be the question id');
});

// ── No password or token in audit entries ─────────────────────────────────────

test('no audit log entry contains a password or token', { skip: !canUseDatabase }, async () => {
  // Trigger a login success to create an entry.
  const email = testEmail();
  const user = await User.create({
    name: 'Audit No Secrets',
    email,
    passwordHash: await bcrypt.hash('ExamplePassword1!', 10),
    role: 'student',
  });
  await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'ExamplePassword1!' }),
  });

  // Check every field of every recent entry.
  const entries = await AuditLog.find({ userId: user._id }).lean();
  assert.ok(entries.length > 0, 'at least one entry should exist');

  for (const entry of entries) {
    const json = JSON.stringify(entry);
    assert.ok(
      !/password/i.test(json) || /passwordHash/.test(json) === false,
      'audit entry should not contain the word password'
    );
    // The audit schema only has userId, action, targetId, ipAddress, timestamp and _id.
    // None of those fields store a token or password.
    assert.equal(Object.hasOwn(entry, 'token'), false, 'no token field in audit entry');
    assert.equal(Object.hasOwn(entry, 'password'), false, 'no password field in audit entry');
    assert.equal(Object.hasOwn(entry, 'passwordHash'), false, 'no passwordHash field in audit entry');
  }
});

// ── Helper ─────────────────────────────────────────────────────────────────────

async function createUserWithTokenHelper(role) {
  emailCounter += 1;
  const user = await User.create({
    name: `Test ${role}`,
    email: `csq-audit-${role}-${process.pid}-${Date.now()}-${emailCounter}@example.test`,
    passwordHash: await bcrypt.hash('ExamplePassword1!', 10),
    role,
  });
  const token = signToken({ sub: user._id.toString(), role: user.role });
  return { user, token, headers: { Authorization: `Bearer ${token}` } };
}
