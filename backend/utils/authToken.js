const crypto = require('crypto');

const TOKEN_TTL_SECONDS = 30 * 60;
const TOKEN_SECRET = process.env.JWT_SECRET || process.env.AUTH_TOKEN_SECRET || 'development-only-change-me';
const revokedTokens = new Set();

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
  if (revokedTokens.has(tokenFingerprint(token))) throw new Error('Revoked token');
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

function revokeToken(token) {
  if (typeof token === 'string' && token) revokedTokens.add(tokenFingerprint(token));
}

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  try {
    req.auth = verifyToken(token);
    req.authToken = token;
    return next();
  } catch {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

module.exports = { TOKEN_TTL_SECONDS, signToken, verifyToken, revokeToken, requireAuth };
