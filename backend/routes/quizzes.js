const express = require('express');
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Question = require('../models/Question');
const { requireAuth } = require('../utils/authToken');
const { requireRoles } = require('../middleware/authorization');
const { requireDatabase } = require('../middleware/database');
const { validateQuizInput } = require('../utils/quizValidation');

const router = express.Router();
const contributorOnly = [requireAuth, requireRoles('contributor'), requireDatabase];
const studentOnly = [requireAuth, requireRoles('student'), requireDatabase];
const { toAttemptResponse, toAttemptQuestion } = require('../utils/quizAttempt');

function toQuizResponse(quiz) {
  return {
    id: quiz._id,
    title: quiz.title,
    timeLimitMinutes: quiz.timeLimitMinutes,
    questionCount: quiz.questionIds.length,
    questionIds: quiz.questionIds,
    creatorId: quiz.creatorId,
    status: quiz.status,
    publishedAt: quiz.publishedAt,
    createdAt: quiz.createdAt,
  };
}

router.post('/', ...contributorOnly, async (req, res) => {
  const validation = validateQuizInput(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });
  try {
    const questionIds = validation.value.questionIds.map(id => new mongoose.Types.ObjectId(id));
    const count = await Question.countDocuments({ _id: { $in: questionIds } });
    if (count !== questionIds.length) return res.status(400).json({ message: 'All selected questions must exist' });
    const quiz = await Quiz.create({ ...validation.value, questionIds, creatorId: req.auth.sub });
    return res.status(201).json({ message: 'Quiz created', quiz: toQuizResponse(quiz) });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') return res.status(400).json({ message: 'Invalid quiz details' });
    console.error('Creating quiz failed:', error.message);
    return res.status(500).json({ message: 'Unable to create quiz' });
  }
});

router.post('/:id/publish', ...contributorOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Quiz not found' });
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    if (quiz.creatorId.toString() !== req.auth.sub) return res.status(403).json({ message: 'Access denied' });
    quiz.status = 'published';
    quiz.publishedAt = new Date();
    await quiz.save();
    return res.json({ message: 'Quiz published', quiz: toQuizResponse(quiz) });
  } catch (error) {
    console.error('Publishing quiz failed:', error.message);
    return res.status(500).json({ message: 'Unable to publish quiz' });
  }
});

router.get('/published', requireAuth, requireRoles('student'), requireDatabase, async (req, res) => {
  const quizzes = await Quiz.find({ status: 'published' }).sort({ publishedAt: -1, _id: -1 }).lean();
  return res.json({ quizzes: quizzes.map(toQuizResponse) });
});

router.post('/:id/attempts', ...studentOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Quiz not found' });
  try {
    const serverReceivedAt = Date.now();
    const quiz = await Quiz.findOne({ _id: req.params.id, status: 'published' }).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });

    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + quiz.timeLimitMinutes * 60 * 1000);
    const questions = await Question.find({ _id: { $in: quiz.questionIds } })
      .select('text options topic difficulty')
      .lean();
    if (questions.length !== quiz.questionIds.length) return res.status(409).json({ message: 'This quiz is not available to attempt' });
    const attempt = await QuizAttempt.create({
      quizId: quiz._id,
      studentId: req.auth.sub,
      startedAt,
      expiresAt,
      status: 'in_progress',
    });
    const questionsById = new Map(questions.map(question => [question._id.toString(), question]));

    return res.status(201).json({
      message: 'Quiz attempt started',
      attempt: toAttemptResponse(attempt, new Date(), Date.now() - serverReceivedAt),
      quiz: { id: quiz._id, title: quiz.title, timeLimitMinutes: quiz.timeLimitMinutes },
      questions: quiz.questionIds.map(id => questionsById.get(id.toString())).filter(Boolean).map(toAttemptQuestion),
    });
  } catch (error) {
    console.error('Starting quiz attempt failed:', error.message);
    return res.status(500).json({ message: 'Unable to start quiz attempt' });
  }
});

router.get('/attempts/:attemptId', ...studentOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(404).json({ message: 'Quiz attempt not found' });
  try {
    const serverReceivedAt = Date.now();
    let attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, studentId: req.auth.sub });
    if (!attempt) return res.status(404).json({ message: 'Quiz attempt not found' });
    const serverTime = new Date();
    if (attempt.status === 'in_progress' && attempt.expiresAt <= serverTime) {
      attempt = await QuizAttempt.findOneAndUpdate(
        { _id: attempt._id, studentId: req.auth.sub, status: 'in_progress', expiresAt: { $lte: serverTime } },
        { $set: { status: 'timed_out', submittedAt: serverTime } },
        { new: true }
      ) || attempt;
    }

    const quiz = await Quiz.findById(attempt.quizId).lean();
    if (!quiz) return res.status(404).json({ message: 'Quiz not found' });
    const questions = await Question.find({ _id: { $in: quiz.questionIds } })
      .select('text options topic difficulty')
      .lean();
    const questionsById = new Map(questions.map(question => [question._id.toString(), question]));
    const responseTime = new Date();
    return res.json({
      attempt: toAttemptResponse(attempt, responseTime, responseTime.getTime() - serverReceivedAt),
      quiz: { id: quiz._id, title: quiz.title, timeLimitMinutes: quiz.timeLimitMinutes },
      questions: quiz.questionIds.map(id => questionsById.get(id.toString())).filter(Boolean).map(toAttemptQuestion),
    });
  } catch (error) {
    console.error('Loading quiz attempt failed:', error.message);
    return res.status(500).json({ message: 'Unable to load quiz attempt' });
  }
});

router.put('/attempts/:attemptId/answers', ...studentOnly, async (req, res) => {
  const { questionId, selectedIndex } = req.body || {};
  if (!mongoose.isValidObjectId(req.params.attemptId) || !mongoose.isValidObjectId(questionId)
    || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) {
    return res.status(400).json({ message: 'A valid question and answer are required' });
  }

  try {
    const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, studentId: req.auth.sub });
    if (!attempt) return res.status(404).json({ message: 'Quiz attempt not found' });
    if (attempt.status !== 'in_progress') return res.status(409).json({ message: 'Quiz attempt is already submitted' });
    const quiz = await Quiz.findById(attempt.quizId).select('questionIds').lean();
    if (!quiz || !quiz.questionIds.some(id => id.toString() === questionId)) {
      return res.status(400).json({ message: 'Question is not part of this quiz' });
    }

    const serverTime = new Date();
    const updated = await QuizAttempt.findOneAndUpdate(
      { _id: attempt._id, studentId: req.auth.sub, status: 'in_progress', expiresAt: { $gt: serverTime } },
      { $set: { [`answers.${questionId}`]: selectedIndex } },
      { new: true, runValidators: true }
    );
    if (!updated) {
      const current = await QuizAttempt.findOne({ _id: attempt._id, studentId: req.auth.sub });
      if (current?.status === 'in_progress' && current.expiresAt <= serverTime) {
        const timedOut = await QuizAttempt.findOneAndUpdate(
          { _id: current._id, status: 'in_progress', expiresAt: { $lte: serverTime } },
          { $set: { status: 'timed_out', submittedAt: serverTime } },
          { new: true }
        );
        return res.status(409).json({ message: 'Time is up', attempt: timedOut ? toAttemptResponse(timedOut, serverTime) : toAttemptResponse(current, serverTime) });
      }
      return res.status(409).json({ message: 'Quiz attempt is already submitted' });
    }
    return res.json({ message: 'Answer saved', attempt: toAttemptResponse(updated, serverTime) });
  } catch (error) {
    console.error('Saving quiz answer failed:', error.message);
    return res.status(500).json({ message: 'Unable to save quiz answer' });
  }
});

router.post('/attempts/:attemptId/submit', ...studentOnly, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.attemptId)) return res.status(404).json({ message: 'Quiz attempt not found' });
  try {
    const serverTime = new Date();
    let attempt = await QuizAttempt.findOneAndUpdate(
      { _id: req.params.attemptId, studentId: req.auth.sub, status: 'in_progress' },
      [{ $set: {
        status: { $cond: [{ $lte: ['$expiresAt', serverTime] }, 'timed_out', 'submitted'] },
        submittedAt: serverTime,
      } }],
      { new: true }
    );
    if (!attempt) attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, studentId: req.auth.sub });
    if (!attempt) return res.status(404).json({ message: 'Quiz attempt not found' });
    return res.json({ message: 'Quiz attempt submitted', attempt: toAttemptResponse(attempt, serverTime) });
  } catch (error) {
    console.error('Submitting quiz attempt failed:', error.message);
    return res.status(500).json({ message: 'Unable to submit quiz attempt' });
  }
});

module.exports = router;
