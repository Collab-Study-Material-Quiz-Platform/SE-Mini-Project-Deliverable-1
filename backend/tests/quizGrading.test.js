const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { gradeAttempt } = require('../utils/quizGrading');

function makeQuestions(count) {
  return Array.from({ length: count }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(),
    text: `Question ${i}`,
    options: ['a', 'b', 'c', 'd'],
    correctIndex: i % 4,
    topic: i % 2 === 0 ? 'Algebra' : 'Geometry',
  }));
}

const idsOf = questions => questions.map(question => question._id);

test('a 10-question quiz with 7 correct answers scores 7/10 and 70%', () => {
  const questions = makeQuestions(10);
  const answers = new Map();
  // 7 correct, 2 wrong, 1 unanswered.
  questions.slice(0, 7).forEach(question => answers.set(question._id.toString(), question.correctIndex));
  questions.slice(7, 9).forEach(question => answers.set(question._id.toString(), (question.correctIndex + 1) % 4));

  const result = gradeAttempt(idsOf(questions), questions, answers);
  assert.equal(result.score, 7);
  assert.equal(result.total, 10);
  assert.equal(result.percentage, 70);
});

test('correct answers earn 1 mark and wrong or unanswered questions earn 0', () => {
  const questions = makeQuestions(3);
  const answers = {
    [questions[0]._id]: questions[0].correctIndex,
    [questions[1]._id]: (questions[1].correctIndex + 1) % 4,
  };

  const [correct, wrong, unanswered] = gradeAttempt(idsOf(questions), questions, answers).questions;
  assert.equal(correct.correct, true);
  assert.equal(wrong.correct, false);
  assert.equal(wrong.selectedIndex, (questions[1].correctIndex + 1) % 4);
  assert.equal(unanswered.correct, false);
  assert.equal(unanswered.selectedIndex, null);
});

test('option 0 is treated as an answer, not as unanswered', () => {
  const question = { ...makeQuestions(1)[0], correctIndex: 0 };
  const result = gradeAttempt([question._id], [question], new Map([[question._id.toString(), 0]]));
  assert.equal(result.score, 1);
  assert.equal(result.questions[0].selectedIndex, 0);
});

test('an attempt with no answers scores 0 out of the full total', () => {
  const questions = makeQuestions(5);
  const result = gradeAttempt(idsOf(questions), questions, new Map());
  assert.equal(result.score, 0);
  assert.equal(result.total, 5);
  assert.equal(result.percentage, 0);
});

test('every question reports its correct answer, in quiz order', () => {
  const questions = makeQuestions(4);
  const shuffled = [questions[2], questions[0], questions[3], questions[1]];
  const result = gradeAttempt(idsOf(questions), shuffled, new Map());
  assert.deepEqual(result.questions.map(item => item.text), questions.map(item => item.text));
  assert.deepEqual(result.questions.map(item => item.correctIndex), questions.map(item => item.correctIndex));
  assert.deepEqual(result.questions.map(item => item.topic), questions.map(item => item.topic));
});

test('percentages are rounded to one decimal place', () => {
  const questions = makeQuestions(3);
  const answers = new Map([[questions[0]._id.toString(), questions[0].correctIndex]]);
  assert.equal(gradeAttempt(idsOf(questions), questions, answers).percentage, 33.3);
});

test('a question that no longer exists still counts towards the total', () => {
  const questions = makeQuestions(2);
  const missingId = new mongoose.Types.ObjectId();
  const answers = new Map(questions.map(question => [question._id.toString(), question.correctIndex]));
  const result = gradeAttempt([...idsOf(questions), missingId], questions, answers);
  assert.equal(result.score, 2);
  assert.equal(result.total, 3);
  assert.equal(result.questions[2].correct, false);
  assert.equal(result.questions[2].correctIndex, null);
});
