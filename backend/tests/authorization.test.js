const test = require('node:test');
const assert = require('node:assert/strict');
const { requireRoles, ROLE_PERMISSIONS } = require('../middleware/authorization');

function invokeRoleMiddleware(role, auth) {
  const result = { statusCode: 200, body: null, nextCalled: false };
  const req = { auth };
  const res = {
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };
  requireRoles(role)(req, res, () => { result.nextCalled = true; });
  return result;
}

test('role middleware permits the configured role and rejects other roles with exact 403 response', () => {
  const contributor = invokeRoleMiddleware('contributor', { sub: 'contributor-id', role: 'contributor' });
  assert.equal(contributor.nextCalled, true);
  const student = invokeRoleMiddleware('contributor', { sub: 'student-id', role: 'student' });
  assert.equal(student.statusCode, 403);
  assert.deepEqual(student.body, { message: 'Access denied' });
  const admin = invokeRoleMiddleware('contributor', { sub: 'admin-id', role: 'admin' });
  assert.equal(admin.statusCode, 403);
});

test('permission matrix gives every account exactly one supported role', () => {
  assert.deepEqual(Object.keys(ROLE_PERMISSIONS).sort(), ['admin', 'contributor', 'student']);
  for (const [role, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    assert.ok(permissions.length > 0);
    assert.equal(typeof role, 'string');
    assert.equal(new Set(permissions).size, permissions.length);
  }
  assert.equal(ROLE_PERMISSIONS.student.includes('upload_material'), false);
  assert.equal(ROLE_PERMISSIONS.student.includes('manage_questions'), false);
  assert.equal(ROLE_PERMISSIONS.contributor.includes('upload_material'), true);
  assert.equal(ROLE_PERMISSIONS.admin.includes('manage_users'), true);
});

