const test = require('node:test');
const assert = require('node:assert/strict');
const { containsUnsafeInput } = require('../middleware/inputValidation');

test('rejects script and event-handler payloads', () => {
  assert.equal(containsUnsafeInput('<script>alert(1)</script>'), true);
  assert.equal(containsUnsafeInput({ title: 'safe', body: '<img onerror=alert(1)>' }), true);
  assert.equal(containsUnsafeInput('javascript:alert(1)'), true);
});

test('rejects database operators and SQL command payloads', () => {
  assert.equal(containsUnsafeInput({ email: { $gt: '' } }), true);
  assert.equal(containsUnsafeInput('1 UNION SELECT passwordHash FROM users'), true);
  assert.equal(containsUnsafeInput('DROP TABLE users'), true);
});

test('accepts ordinary user input', () => {
  assert.equal(containsUnsafeInput({ name: 'Alex Student', topic: 'Algebra', password: 'ExamplePassword1!' }), false);
});
