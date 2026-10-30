const express = require('express');
const mongoose = require('mongoose');
const Quiz = require('../models/Quiz');
const Question = require('../models/Question');
const { requireAuth } = require('../utils/authToken');
const { requireRoles } = require('../middleware/authorization');
const { requireDatabase } = require('../middleware/database');
const { validateQuizInput } = require('../utils/quizValidation');

const router = express.Router();
const contributorOnly = [requireAuth, requireRoles('contributor'), requireDatabase];

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

module.exports = router;
