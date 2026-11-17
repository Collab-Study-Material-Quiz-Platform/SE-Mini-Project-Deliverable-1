const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const RevokedToken = require('../models/RevokedToken');
const { signToken } = require('../utils/authToken');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

let api;

test.before(async () => {
  if (!canUseDatabase) return;
  api = await startTestServer([User, RevokedToken]);
});

test.after(async () => {
  if (api) await api.stop();
});

function call(method, path, token) {
  return fetch(`${api.baseUrl}/api/auth${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

test('TC-Auth-04: logout ends the session immediately and the old token is refused', { skip: !canUseDatabase }, async () => {
  const { token } = await createUserWithToken('student');
  assert.equal((await call('GET', '/me', token)).status, 200);

  const logout = await call('POST', '/logout', token);
  assert.equal(logout.status, 200);
  assert.equal((await logout.json()).message, 'Logout successful');

  const reused = await call('GET', '/me', token);
  assert.equal(reused.status, 401);
  assert.equal((await reused.json()).message, 'Unauthorized');
  assert.equal((await fetch(`${api.baseUrl}/api/materials`, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
});

test('TC-Sec-03: logging out twice with the same token is refused the second time', { skip: !canUseDatabase }, async () => {
  const { token } = await createUserWithToken('contributor');
  assert.equal((await call('POST', '/logout', token)).status, 200);
  assert.equal((await call('POST', '/logout', token)).status, 401);
});

test('logout without a token returns 401', { skip: !canUseDatabase }, async () => {
  assert.equal((await call('POST', '/logout')).status, 401);
});

test('refresh issues a new working token and revokes the old one', { skip: !canUseDatabase }, async () => {
  const { user, token } = await createUserWithToken('student');
  const response = await call('POST', '/refresh', token);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.token);
  assert.notEqual(body.token, token);
  assert.equal(body.user.id, user._id.toString());
  assert.equal(body.user.role, 'student');
  assert.equal(Object.hasOwn(body.user, 'passwordHash'), false);

  assert.equal((await call('GET', '/me', body.token)).status, 200);
  assert.equal((await call('GET', '/me', token)).status, 401);
});

test('refresh and /me refuse a valid token whose user no longer exists', { skip: !canUseDatabase }, async () => {
  const token = signToken({ sub: new mongoose.Types.ObjectId().toString(), role: 'student' });
  assert.equal((await call('GET', '/me', token)).status, 401);
  assert.equal((await call('POST', '/refresh', token)).status, 401);
});
