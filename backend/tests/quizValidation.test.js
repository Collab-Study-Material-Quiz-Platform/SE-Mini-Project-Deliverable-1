const test = require('node:test');
const assert = require('node:assert/strict');
const { validateQuizInput } = require('../utils/quizValidation');

const ids = ['507f1f77bcf86cd799439011', '507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013', '507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015'];

test('accepts a valid quiz with 5 questions and a 5-minute limit', () => {
  const result = validateQuizInput({ title: 'Algebra Basics', timeLimitMinutes: 5, questionIds: ids });
  assert.equal(result.error, undefined);
  assert.deepEqual(result.value.questionIds, ids);
});

test('rejects invalid quiz time limits and question counts', () => {
  assert.equal(validateQuizInput({ title: 'Quiz', timeLimitMinutes: 4, questionIds: ids }).error, 'Time limit must be between 5 and 180 minutes');
  assert.equal(validateQuizInput({ title: 'Quiz', timeLimitMinutes: 181, questionIds: ids }).error, 'Time limit must be between 5 and 180 minutes');
  assert.equal(validateQuizInput({ title: 'Quiz', timeLimitMinutes: 30, questionIds: ids.slice(0, 4) }).error, 'Quiz must contain 5 to 50 questions');
  assert.equal(validateQuizInput({ title: 'Quiz', timeLimitMinutes: 30, questionIds: [...ids, ...ids] }).error, 'Question IDs must be valid and unique');
});
