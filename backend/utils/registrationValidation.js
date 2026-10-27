const ALLOWED_ROLES = new Set(['student', 'contributor']);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistrationInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body is required' };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const rawRole = body.role == null || body.role === ''
    ? 'student'
    : (typeof body.role === 'string' ? body.role.trim().toLowerCase() : '');

  if (name.length < 2 || name.length > 50) {
    return { error: 'Name must be between 2 and 50 characters' };
  }

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'A valid email address is required' };
  }

  if (!password) {
    return { error: 'Password is required' };
  }

  // bcrypt considers at most 72 UTF-8 bytes; reject longer inputs rather than silently truncating them.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return { error: 'Password must not exceed 72 UTF-8 bytes' };
  }

  // Public registration may create students or contributors, never administrators.
  if (!ALLOWED_ROLES.has(rawRole)) {
    return { error: 'Role must be Student or Contributor' };
  }

  return {
    value: {
      name,
      email,
      password,
      role: rawRole,
    },
  };
}

module.exports = { validateRegistrationInput };
