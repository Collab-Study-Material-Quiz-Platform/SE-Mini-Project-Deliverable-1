require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const app = require('../app');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const AuditLog = require('../models/AuditLog');
const { canUseDatabase, startTestServer, createUserWithToken } = require('./helpers/testServer');

let server;
let baseUrl;

test.before(async () => {
  if (!canUseDatabase) return;
  const result = await startTestServer([Quiz, Question, AuditLog]);
  baseUrl = result.baseUrl;
  server = result;
});

test.after(async () => {
  if (server) await server.stop();
});

async function createQuizWithQuestions(creator) {
  // Create 5 questions owned by the creator so the quiz can be created.
  const questionIds = [];
  for (let i = 0; i < 5; i++) {
    const q = await Question.create({
      text: `Delete-quiz question ${i + 1}`,
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      topic: 'Algebra',
      difficulty: 'Easy',
      ownerId: creator.user._id,
    });
    questionIds.push(q._id);
  }

  const quiz = await Quiz.create({
    title: 'Quiz to delete',
    timeLimitMinutes: 10,
    questionIds,
    creatorId: creator.user._id,
    status: 'published',
    publishedAt: new Date(),
  });
  return quiz;
}

async function deleteQuiz(id, headers) {
  return fetch(`${baseUrl}/api/quizzes/${id}`, {
    method: 'DELETE',
    headers,
  });
}

// ── The owner deletes their own quiz ──────────────────────────────────────────

test('the creator deletes their own quiz and gets 200', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const quiz = await createQuizWithQuestions(contributor);

  const response = await deleteQuiz(quiz._id, contributor.headers);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).message, 'Quiz deleted');

  // Verify soft delete: status is 'removed', document still exists.
  const updated = await Quiz.findById(quiz._id).lean();
  assert.ok(updated, 'quiz document should still exist (soft delete)');
  assert.equal(updated.status, 'removed');
});

// ── After deletion the quiz is no longer returned for Students ─────────────────

test('a deleted quiz is not returned in the published list for students', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const student = await createUserWithToken('student');
  const quiz = await createQuizWithQuestions(contributor);

  // Confirm it appears before deletion.
  const before = await fetch(`${baseUrl}/api/quizzes/published`, { headers: student.headers });
  const beforeBody = await before.json();
  assert.ok(beforeBody.quizzes.some(q => q.id === quiz._id.toString()), 'quiz should be listed before deletion');

  await deleteQuiz(quiz._id, contributor.headers);

  // Confirm it no longer appears.
  const after = await fetch(`${baseUrl}/api/quizzes/published`, { headers: student.headers });
  const afterBody = await after.json();
  assert.ok(
    !afterBody.quizzes.some(q => q.id === quiz._id.toString()),
    'quiz should not be listed after deletion'
  );
});

// ── After deletion the attempt-start endpoint returns 404 ───────────────────────

test('a deleted quiz cannot be started by a student', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const student = await createUserWithToken('student');
  const quiz = await createQuizWithQuestions(contributor);

  await deleteQuiz(quiz._id, contributor.headers);

  const response = await fetch(`${baseUrl}/api/quizzes/${quiz._id}/attempts`, {
    method: 'POST',
    headers: student.headers,
  });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, 'Quiz not found');
});

// ── Another Contributor gets 403 "Access denied" ───────────────────────────────

test('another contributor cannot delete the quiz and gets 403 Access denied', { skip: !canUseDatabase }, async () => {
  const owner = await createUserWithToken('contributor');
  const other = await createUserWithToken('contributor');
  const quiz = await createQuizWithQuestions(owner);

  const response = await deleteQuiz(quiz._id, other.headers);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).message, 'Access denied');

  // The quiz should still be there and published.
  const unchanged = await Quiz.findById(quiz._id).lean();
  assert.equal(unchanged.status, 'published');
});

// ── A Student gets 403 ─────────────────────────────────────────────────────────

test('a student cannot delete a quiz and gets 403', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const student = await createUserWithToken('student');
  const quiz = await createQuizWithQuestions(contributor);

  const response = await deleteQuiz(quiz._id, student.headers);
  assert.equal(response.status, 403);
});

// ── A missing quiz gets 404 ─────────────────────────────────────────────────────

test('deleting a missing quiz returns 404', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const fakeId = new mongoose.Types.ObjectId();
  const response = await deleteQuiz(fakeId, contributor.headers);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).message, 'Quiz not found');
});

// ── An already-removed quiz gets 404 ─────────────────────────────────────────────

test('deleting an already-removed quiz returns 404', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const quiz = await createQuizWithQuestions(contributor);

  // Soft delete it first.
  await deleteQuiz(quiz._id, contributor.headers);

  // Try to delete again.
  const response = await deleteQuiz(quiz._id, contributor.headers);
  assert.equal(response.status, 404);
});

// ── One audit entry is written ─────────────────────────────────────────────────────

test('deleting a quiz writes exactly one DELETE audit entry', { skip: !canUseDatabase }, async () => {
  const contributor = await createUserWithToken('contributor');
  const quiz = await createQuizWithQuestions(contributor);

  const before = await AuditLog.countDocuments({ userId: contributor.user._id, action: 'DELETE', targetId: quiz._id });

  await deleteQuiz(quiz._id, contributor.headers);

  const after = await AuditLog.countDocuments({ userId: contributor.user._id, action: 'DELETE', targetId: quiz._id });
  assert.equal(after - before, 1, 'exactly one DELETE audit entry should be created');
});
