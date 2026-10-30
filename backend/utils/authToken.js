const crypto = require('crypto');
const mongoose = require('mongoose');
const RevokedToken = require('../models/RevokedToken');

const TOKEN_TTL_SECONDS = 30 * 60;
const configuredSecret = process.env.JWT_SECRET || process.env.AUTH_TOKEN_SECRET;
const allowsDevelopmentSecret = ['development', 'test'].includes(process.env.NODE_ENV);
if (!configuredSecret && !allowsDevelopmentSecret) {
  throw new Error('JWT_SECRET must be configured outside development and test environments');
}
if (process.env.NODE_ENV === 'production' && Buffer.byteLength(configuredSecret) < 32) {
  throw new Error('Set JWT_SECRET to a random value of at least 32 bytes in production');
}
const TOKEN_SECRET = configuredSecret || 'development-only-change-me';

function tokenFingerprint(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function signToken(payload, now = Math.floor(Date.now() / 1000)) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, jti: crypto.randomUUID(), iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const unsigned = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(unsigned).digest('base64url');
  return `${unsigned}.${signature}`;
}

function verifyToken(token, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== 'string') throw new Error('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, body, signature] = parts;
  const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(`${header}.${body}`).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error('Invalid token');
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid token');
  }
  if (!payload.sub || !payload.role || !Number.isInteger(payload.exp) || payload.exp <= now) {
    throw new Error('Expired or invalid token');
  }
  return payload;
}

async function isTokenRevoked(token) {
  if (mongoose.connection.readyState !== 1) throw new Error('Revocation store unavailable');
  return Boolean(await RevokedToken.exists({ tokenHash: tokenFingerprint(token) }));
}

async function revokeToken(token, expiresAt) {
  if (typeof token !== 'string' || !token) throw new Error('Invalid token');
  if (mongoose.connection.readyState !== 1) throw new Error('Revocation store unavailable');
  const payload = verifyToken(token);
  await RevokedToken.updateOne(
    { tokenHash: tokenFingerprint(token) },
    { $setOnInsert: { tokenHash: tokenFingerprint(token), expiresAt: expiresAt || new Date(payload.exp * 1000) } },
    { upsert: true }
  );
}

async function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    if (await isTokenRevoked(token)) return res.status(401).json({ message: 'Unauthorized' });
  } catch {
    return res.status(503).json({ message: 'Database unavailable' });
  }

  req.auth = payload;
  req.authToken = token;
  return next();
}

module.exports = { TOKEN_TTL_SECONDS, signToken, verifyToken, isTokenRevoked, revokeToken, requireAuth };
