const test = require('node:test');
const assert = require('node:assert/strict');
const { validateMaterialInput, parseMaterialSearch } = require('../utils/materialValidation');

test('accepts and trims upload metadata', () => {
  const result = validateMaterialInput({ title: '  Calculus Notes ', subject: ' Mathematics ', topic: ' Limits ' });
  assert.deepEqual(result.value, { title: 'Calculus Notes', subject: 'Mathematics', topic: 'Limits' });
});

test('rejects missing or overlong upload metadata', () => {
  const base = { title: 'Notes', subject: 'Maths', topic: 'Algebra' };
  assert.equal(validateMaterialInput(null).error, 'Title, subject and topic are required');
  assert.equal(validateMaterialInput({ ...base, title: '' }).error, 'Title is required');
  assert.equal(validateMaterialInput({ ...base, title: 'x'.repeat(101) }).error, 'Title must not exceed 100 characters');
  assert.equal(validateMaterialInput({ ...base, title: 'x'.repeat(100) }).error, undefined);
  assert.equal(validateMaterialInput({ ...base, subject: ' ' }).error, 'Subject is required');
  assert.equal(validateMaterialInput({ ...base, topic: undefined }).error, 'Topic is required');
});

test('builds a keyword, subject and topic search filter', () => {
  const { value } = parseMaterialSearch({ q: ' matrices ', subject: 'Mathematics', topic: 'ALGEBRA', page: '2' });
  assert.deepEqual(value, {
    filter: { $text: { $search: 'matrices' }, subjectKey: 'mathematics', topicKey: 'algebra' },
    page: 2,
  });
});

test('an empty search lists every material from page 1', () => {
  assert.deepEqual(parseMaterialSearch({}).value, { filter: {}, page: 1 });
});

test('rejects invalid page numbers', () => {
  for (const page of ['0', '-1', 'abc', '1.5', ['1', '2']]) {
    assert.equal(parseMaterialSearch({ page }).error, 'Page must be a positive whole number');
  }
});

test('ignores non-string search parameters such as operator objects', () => {
  assert.deepEqual(parseMaterialSearch({ subject: { $ne: null }, topic: ['a', 'b'] }).value, { filter: {}, page: 1 });
});
