const test = require('node:test');
const assert = require('node:assert/strict');
const { validateQuestionInput, normalizeDifficulty, parseQuestionFilter } = require('../utils/questionValidation');

const valid = {
  text: 'What is 2 + 2?',
  options: ['3', '4', '5', '22'],
  correctIndex: 1,
  topic: 'Algebra',
  difficulty: 'Easy',
};

test('accepts a question with four options and one correct option', () => {
  assert.deepEqual(validateQuestionInput({ ...valid, text: '  What is 2 + 2?  ', topic: ' Algebra ' }).value, valid);
});

test('accepts options given as objects with exactly one marked correct', () => {
  const options = [
    { text: '3', isCorrect: false },
    { text: '4', isCorrect: true },
    { text: '5' },
    { text: '22', isCorrect: false },
  ];
  const { value } = validateQuestionInput({ ...valid, options, correctIndex: undefined });
  assert.deepEqual(value.options, ['3', '4', '5', '22']);
  assert.equal(value.correctIndex, 1);
});

test('limits question text to 500 characters', () => {
  assert.equal(validateQuestionInput({ ...valid, text: 'q'.repeat(500) }).error, undefined);
  assert.equal(validateQuestionInput({ ...valid, text: 'q'.repeat(501) }).error, 'Question text must not exceed 500 characters');
  assert.equal(validateQuestionInput({ ...valid, text: '   ' }).error, 'Question text is required');
});

test('requires exactly four options', () => {
  assert.equal(validateQuestionInput({ ...valid, options: ['a', 'b', 'c'] }).error, 'Exactly four options are required');
  assert.equal(validateQuestionInput({ ...valid, options: ['a', 'b', 'c', 'd', 'e'] }).error, 'Exactly four options are required');
  assert.equal(validateQuestionInput({ ...valid, options: 'a,b,c,d' }).error, 'Exactly four options are required');
  assert.equal(validateQuestionInput({ ...valid, options: undefined }).error, 'Exactly four options are required');
});

test('rejects empty, mixed or duplicate options', () => {
  assert.equal(validateQuestionInput({ ...valid, options: ['a', ' ', 'c', 'd'] }).error, 'Options must not be empty');
  assert.equal(validateQuestionInput({ ...valid, options: ['a', 2, 'c', 'd'] }).error, 'Options must be text');
  assert.equal(validateQuestionInput({ ...valid, options: ['a', 'A', 'c', 'd'] }).error, 'Options must be different');
  assert.equal(validateQuestionInput({ ...valid, options: ['a', 'b', 'c', 'd'.repeat(201)] }).error, 'Options must not exceed 200 characters');
});

test('requires exactly one correct option', () => {
  const error = 'Exactly one correct option is required';
  assert.equal(validateQuestionInput({ ...valid, correctIndex: undefined }).error, error);
  assert.equal(validateQuestionInput({ ...valid, correctIndex: 4 }).error, error);
  assert.equal(validateQuestionInput({ ...valid, correctIndex: -1 }).error, error);
  assert.equal(validateQuestionInput({ ...valid, correctIndex: '1' }).error, error);
  assert.equal(validateQuestionInput({ ...valid, correctIndex: [0, 1] }).error, error);
  const twoCorrect = ['a', 'b', 'c', 'd'].map((text, i) => ({ text, isCorrect: i < 2 }));
  assert.equal(validateQuestionInput({ ...valid, options: twoCorrect }).error, error);
  const noneCorrect = ['a', 'b', 'c', 'd'].map(text => ({ text, isCorrect: false }));
  assert.equal(validateQuestionInput({ ...valid, options: noneCorrect }).error, error);
});

test('requires a topic and a difficulty of Easy, Medium or Hard', () => {
  assert.equal(validateQuestionInput({ ...valid, topic: '' }).error, 'Topic is required');
  assert.equal(validateQuestionInput({ ...valid, topic: 't'.repeat(101) }).error, 'Topic must not exceed 100 characters');
  assert.equal(validateQuestionInput({ ...valid, difficulty: undefined }).error, 'Difficulty is required');
  assert.equal(validateQuestionInput({ ...valid, difficulty: 'Expert' }).error, 'Difficulty must be Easy, Medium or Hard');
  assert.equal(validateQuestionInput({ ...valid, difficulty: 'hard' }).value.difficulty, 'Hard');
});

test('normalizes difficulty spelling', () => {
  assert.equal(normalizeDifficulty('MEDIUM'), 'Medium');
  assert.equal(normalizeDifficulty(' easy '), 'Easy');
  assert.equal(normalizeDifficulty('extreme'), null);
  assert.equal(normalizeDifficulty(3), null);
});

test('rejects a missing or non-object body', () => {
  assert.equal(validateQuestionInput(null).error, 'Request body is required');
  assert.equal(validateQuestionInput([]).error, 'Request body is required');
});

test('builds topic, difficulty and combined question filters', () => {
  assert.deepEqual(parseQuestionFilter({}).value, {});
  assert.deepEqual(parseQuestionFilter({ topic: ' Algebra ' }).value, { topicKey: 'algebra' });
  assert.deepEqual(parseQuestionFilter({ difficulty: 'easy' }).value, { difficulty: 'Easy' });
  assert.deepEqual(parseQuestionFilter({ topic: 'Algebra', difficulty: 'Easy' }).value, { topicKey: 'algebra', difficulty: 'Easy' });
  assert.equal(parseQuestionFilter({ difficulty: 'Expert' }).error, 'Difficulty must be Easy, Medium or Hard');
  assert.deepEqual(parseQuestionFilter({ topic: { $ne: null } }).value, {});
});
