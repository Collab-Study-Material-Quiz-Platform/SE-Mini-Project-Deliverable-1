require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../app');
const User = require('../models/User');

const canUseDatabase = Boolean(process.env.MONGO_URI);
let server;
let baseUrl;
let emailCounter = 0;

function testEmail() {
  emailCounter += 1;
  return `csq-registration-${process.pid}-${Date.now()}-${emailCounter}@example.test`;
}

test.before(async () => {
  if (!canUseDatabase) return;
  await mongoose.connect(process.env.MONGO_URI);
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('registers a student, persists a bcrypt hash and returns only safe user fields', { skip: !canUseDatabase }, async () => {
  const email = testEmail();
  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: '  Alex Student  ',
      email: email.toUpperCase(),
      password: 'ExamplePassword1!',
      role: 'student',
    }),
  });
  const elapsed = Date.now() - startedAt;
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.message, 'Registration successful');
  assert.equal(body.user.name, 'Alex Student');
  assert.equal(body.user.email, email);
  assert.equal(body.user.role, 'student');
  assert.ok(body.user.id);
  assert.ok(body.user.createdAt);
  assert.ok(elapsed < 3000, `registration took ${elapsed}ms`);
  assert.equal(Object.hasOwn(body.user, 'passwordHash'), false);
  assert.equal(Object.hasOwn(body.user, 'password'), false);

  const savedUser = await User.findOne({ email }).select('+passwordHash');
  assert.ok(savedUser);
  assert.match(savedUser.passwordHash, /^\$2[aby]\$/);
  assert.equal(await bcrypt.compare('ExamplePassword1!', savedUser.passwordHash), true);
});

test('registers a contributor account', { skip: !canUseDatabase }, async () => {
  const email = testEmail();
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Contributor User', email, password: 'ExamplePassword1!', role: 'contributor' }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.user.role, 'contributor');
});

test('rejects duplicate emails with the required message', { skip: !canUseDatabase }, async () => {
  const email = testEmail();
  const payload = { name: 'Alex Student', email, password: 'ExamplePassword1!', role: 'student' };
  const first = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(first.status, 201);

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.json()).message, 'Email already registered');
});

test('rejects public administrator registration', { skip: !canUseDatabase }, async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Public Admin', email: testEmail(), password: 'ExamplePassword1!', role: 'admin' }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Role must be Student or Contributor');
});

test('rejects invalid input before attempting persistence', { skip: !canUseDatabase }, async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'A', email: 'not-an-email', password: 'x', role: 'student' }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).message, 'Name must be between 2 and 50 characters');
});
