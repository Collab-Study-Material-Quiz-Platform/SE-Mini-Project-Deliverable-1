const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRegistrationInput } = require('../utils/registrationValidation');

test('accepts student registration, defaults the role, trims the name and normalizes email', () => {
  const result = validateRegistrationInput({
    name: '  Alex Student  ',
    email: '  ALEX@example.com ',
    password: 'ExamplePassword1!',
  });

  assert.equal(result.error, undefined);
  assert.deepEqual(result.value, {
    name: 'Alex Student',
    email: 'alex@example.com',
    password: 'ExamplePassword1!',
    role: 'student',
  });
});

test('accepts contributor registration', () => {
  const result = validateRegistrationInput({
    name: 'Contributor',
    email: 'contributor@example.com',
    password: 'ExamplePassword1!',
    role: 'Contributor',
  });

  assert.equal(result.error, undefined);
  assert.equal(result.value.role, 'contributor');
});

test('rejects names shorter than 2 characters and longer than 50 characters', () => {
  const base = { email: 'alex@example.com', password: 'ExamplePassword1!' };
  assert.equal(validateRegistrationInput({ ...base, name: 'A' }).error,
    'Name must be between 2 and 50 characters');
  assert.equal(validateRegistrationInput({ ...base, name: 'A'.repeat(51) }).error,
    'Name must be between 2 and 50 characters');
});

test('rejects malformed email addresses', () => {
  const result = validateRegistrationInput({
    name: 'Alex',
    email: 'not-an-email',
    password: 'ExamplePassword1!',
  });

  assert.equal(result.error, 'A valid email address is required');
});

test('rejects missing passwords', () => {
  const result = validateRegistrationInput({
    name: 'Alex',
    email: 'alex@example.com',
  });

  assert.equal(result.error, 'Password is required');
});

test('does not allow public registration as an administrator', () => {
  const result = validateRegistrationInput({
    name: 'Alex Admin',
    email: 'admin@example.com',
    password: 'ExamplePassword1!',
    role: 'admin',
  });

  assert.equal(result.error, 'Role must be Student or Contributor');
});

test('rejects an absent or non-object request body', () => {
  assert.equal(validateRegistrationInput(null).error, 'Request body is required');
  assert.equal(validateRegistrationInput([]).error, 'Request body is required');
});

test('rejects passwords longer than bcrypt supports without truncating them', () => {
  const result = validateRegistrationInput({
    name: 'Alex',
    email: 'alex@example.com',
    password: 'a'.repeat(73),
  });

  assert.equal(result.error, 'Password must not exceed 72 UTF-8 bytes');
});
