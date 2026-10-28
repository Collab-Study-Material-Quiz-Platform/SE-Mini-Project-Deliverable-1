const test = require('node:test');
const assert = require('node:assert/strict');
const { signToken, verifyToken, revokeToken } = require('../utils/authToken');

test('revoking a token immediately prevents it from being verified', () => {
  const token = signToken({ sub: 'logout-user', role: 'student' });
  assert.equal(verifyToken(token).sub, 'logout-user');
  revokeToken(token);
  assert.throws(() => verifyToken(token), /Revoked token/);
});
