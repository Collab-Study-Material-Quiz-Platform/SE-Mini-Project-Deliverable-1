const express = require('express');
const mongoose = require('mongoose');
const QuizAttempt = require('../models/QuizAttempt');
const Quiz = require('../models/Quiz');
const { requireAuth } = require('../utils/authToken');
const { requireRoles } = require('../middleware/authorization');
const { requireDatabase } = require('../middleware/database');

const router = express.Router();

/**
 * GET /api/reports/student/me
 *
 * Returns the logged-in Student's personal performance report (CSQ-F-040).
 * Only the token's own studentId is used — no id is accepted from the request.
 *
 * Response shape:
 * {
 *   overallAveragePercentage: number,   // average of attempt percentages, 1 dp, 0 if none
 *   topics: [                           // per-topic aggregate across all submitted attempts
 *     { topic, correct, answered, percentage }
 *   ],
 *   attempts: [                         // last 20 submitted attempts, newest first
 *     { attemptId, quizTitle, submittedAt, score, total, percentage }
 *   ]
 * }
 */
router.get('/student/me', requireAuth, requireRoles('student'), requireDatabase, async (req, res) => {
  try {
    const studentId = new mongoose.Types.ObjectId(req.auth.sub);

    // Fetch all submitted attempts for this student, newest first, capped at 20 for the list.
    // We need all attempts for the topic/average aggregation, so fetch all then slice.
    const allAttempts = await QuizAttempt.find({
      studentId,
      status: { $in: ['submitted', 'timed_out'] },
      result: { $exists: true },
    })
      .sort({ submittedAt: -1 })
      .lean();

    if (allAttempts.length === 0) {
      return res.json({ overallAveragePercentage: 0, topics: [], attempts: [] });
    }

    // ── Overall average ────────────────────────────────────────────────────────
    const overallAveragePercentage = parseFloat(
      (allAttempts.reduce((sum, a) => sum + (a.result?.percentage ?? 0), 0) / allAttempts.length).toFixed(1)
    );

    // ── Per-topic aggregation (across ALL submitted attempts) ─────────────────
    const topicMap = new Map(); // topic -> { correct, answered }
    for (const attempt of allAttempts) {
      for (const q of attempt.result?.questions ?? []) {
        if (!q.topic) continue;
        const entry = topicMap.get(q.topic) ?? { correct: 0, answered: 0 };
        // A question counts as answered if the student selected an answer (selectedIndex != null).
        if (q.selectedIndex !== null && q.selectedIndex !== undefined) {
          entry.answered += 1;
          if (q.correct) entry.correct += 1;
        }
        topicMap.set(q.topic, entry);
      }
    }

    const topics = Array.from(topicMap.entries())
      .filter(([, v]) => v.answered > 0)
      .map(([topic, { correct, answered }]) => ({
        topic,
        correct,
        answered,
        percentage: parseFloat(((correct / answered) * 100).toFixed(1)),
      }))
      .sort((a, b) => a.topic.localeCompare(b.topic));

    // ── Last 20 attempts (already sorted newest first) ─────────────────────────
    const recent = allAttempts.slice(0, 20);

    // Bulk-fetch the quiz titles for the recent attempts (avoids N+1 queries).
    const quizIds = [...new Set(recent.map(a => a.quizId.toString()))];
    const quizDocs = await Quiz.find({ _id: { $in: quizIds } }).select('title').lean();
    const quizTitleMap = new Map(quizDocs.map(q => [q._id.toString(), q.title]));

    const attempts = recent.map(a => ({
      attemptId: a._id,
      quizTitle: quizTitleMap.get(a.quizId.toString()) ?? 'Removed quiz',
      submittedAt: a.submittedAt,
      score: a.result?.score ?? 0,
      total: a.result?.total ?? 0,
      percentage: a.result?.percentage ?? 0,
    }));

    return res.json({ overallAveragePercentage, topics, attempts });
  } catch (error) {
    console.error('Student performance report failed:', error.message);
    return res.status(500).json({ message: 'Unable to load performance report' });
  }
});

// ── Contributor Quiz Statistics Helper (CSQ-F-041) ───────────────────────────

function calculateQuizStats(quiz, attempts) {
  if (!attempts || attempts.length === 0) {
    return {
      quizId: quiz._id,
      id: quiz._id,
      quizTitle: quiz.title,
      title: quiz.title,
      attemptCount: 0,
      averageScore: 0,
      highestScore: 0,
      lowestScore: 0,
      hardestQuestions: [],
    };
  }

  const scores = attempts.map(a => a.result?.score ?? 0);
  const highestScore = Math.max(...scores);
  const lowestScore = Math.min(...scores);
  const averageScore = parseFloat(
    (scores.reduce((sum, s) => sum + s, 0) / attempts.length).toFixed(1)
  );

  // Aggregate correctness per question across all submitted attempts
  const questionMap = new Map();
  for (const attempt of attempts) {
    for (const q of attempt.result?.questions ?? []) {
      const qid = q.questionId.toString();
      const existing = questionMap.get(qid) ?? {
        questionId: q.questionId,
        text: q.text,
        correctCount: 0,
        totalAttempts: 0,
      };
      existing.totalAttempts += 1;
      if (q.correct) {
        existing.correctCount += 1;
      }
      questionMap.set(qid, existing);
    }
  }

  const hardestQuestions = Array.from(questionMap.values())
    .map(q => {
      const correctPercentage = q.totalAttempts === 0
        ? 0
        : parseFloat(((q.correctCount / q.totalAttempts) * 100).toFixed(1));
      return {
        questionId: q.questionId,
        text: q.text,
        correctPercentage,
        percentage: correctPercentage,
        correctCount: q.correctCount,
        correct: q.correctCount,
        totalAttempts: q.totalAttempts,
        total: q.totalAttempts,
      };
    })
    .sort((a, b) => a.correctPercentage - b.correctPercentage || a.text.localeCompare(b.text))
    .slice(0, 3);

  return {
    quizId: quiz._id,
    id: quiz._id,
    quizTitle: quiz.title,
    title: quiz.title,
    attemptCount: attempts.length,
    averageScore,
    highestScore,
    lowestScore,
    hardestQuestions,
  };
}

/**
 * GET /api/reports/contributor/quizzes
 *
 * Returns statistics for all quizzes created by the logged-in Contributor (CSQ-F-041).
 * Shows attempt count, average score, highest score, lowest score, and the 3 hardest questions.
 * Strictly isolated to the authenticated Contributor's own quizzes.
 */
router.get('/contributor/quizzes', requireAuth, requireRoles('contributor'), requireDatabase, async (req, res) => {
  try {
    const contributorId = new mongoose.Types.ObjectId(req.auth.sub);

    const quizzes = await Quiz.find({
      creatorId: contributorId,
      status: { $ne: 'removed' },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (quizzes.length === 0) {
      return res.json({ quizzes: [] });
    }

    const quizIds = quizzes.map(q => q._id);
    const allAttempts = await QuizAttempt.find({
      quizId: { $in: quizIds },
      status: { $in: ['submitted', 'timed_out'] },
      result: { $exists: true },
    }).lean();

    const attemptsByQuiz = new Map();
    for (const attempt of allAttempts) {
      const qid = attempt.quizId.toString();
      if (!attemptsByQuiz.has(qid)) {
        attemptsByQuiz.set(qid, []);
      }
      attemptsByQuiz.get(qid).push(attempt);
    }

    const report = quizzes.map(quiz => {
      const attempts = attemptsByQuiz.get(quiz._id.toString()) || [];
      return calculateQuizStats(quiz, attempts);
    });

    return res.json({ quizzes: report });
  } catch (error) {
    console.error('Contributor quiz statistics report failed:', error.message);
    return res.status(500).json({ message: 'Unable to load contributor quiz statistics' });
  }
});

/**
 * GET /api/reports/contributor/quizzes/:quizId
 *
 * Returns statistics for a specific quiz created by the logged-in Contributor.
 * Rejects with 403 if the quiz belongs to another Contributor.
 */
router.get('/contributor/quizzes/:quizId', requireAuth, requireRoles('contributor'), requireDatabase, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.quizId)) {
    return res.status(404).json({ message: 'Quiz not found' });
  }
  try {
    const quiz = await Quiz.findById(req.params.quizId).lean();
    if (!quiz || quiz.status === 'removed') {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (quiz.creatorId.toString() !== req.auth.sub) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const attempts = await QuizAttempt.find({
      quizId: quiz._id,
      status: { $in: ['submitted', 'timed_out'] },
      result: { $exists: true },
    }).lean();

    return res.json(calculateQuizStats(quiz, attempts));
  } catch (error) {
    console.error('Contributor single quiz report failed:', error.message);
    return res.status(500).json({ message: 'Unable to load quiz statistics' });
  }
});

module.exports = router;
