const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const RevokedToken = require('../models/RevokedToken');
const { TOKEN_TTL_SECONDS, signToken, verifyToken, isTokenRevoked, revokeToken, requireAuth } = require('../utils/authToken');

const canUseDatabase = Boolean(process.env.MONGO_URI);

test.before(async () => {
  if (!canUseDatabase) return;
  await mongoose.connect(process.env.MONGO_URI);
  await RevokedToken.init();
});

test.after(async () => {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

test('signed tokens carry the required 30-minute expiry', () => {
  const token = signToken({ sub: 'logout-user', role: 'student' });
  const payload = verifyToken(token);
  assert.equal(payload.sub, 'logout-user');
  assert.equal(payload.exp - payload.iat, TOKEN_TTL_SECONDS);
});

test('revoking a token persists its revocation until its expiry', { skip: !canUseDatabase }, async () => {
  const token = signToken({ sub: 'logout-user', role: 'student' });
  const payload = verifyToken(token);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  try {
    await revokeToken(token);
    assert.equal(await isTokenRevoked(token), true);

    const response = { statusCode: 200, body: null };
    const req = { get: () => `Bearer ${token}` };
    const res = {
      status(code) { response.statusCode = code; return this; },
      json(body) { response.body = body; return this; },
    };
    let nextCalled = false;
    await requireAuth(req, res, () => { nextCalled = true; });
    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.body, { message: 'Unauthorized' });
    assert.equal(nextCalled, false);
    assert.ok(payload.exp > Math.floor(Date.now() / 1000));
  } finally {
    await RevokedToken.deleteOne({ tokenHash });
  }
});
