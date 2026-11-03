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

module.exports = router;
