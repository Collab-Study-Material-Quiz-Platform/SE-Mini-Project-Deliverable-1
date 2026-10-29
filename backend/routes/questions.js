const express = require('express');
const Question = require('../models/Question');
const { requireAuth } = require('../utils/authToken');
const { requireRoles } = require('../middleware/authorization');
const { requireDatabase } = require('../middleware/database');
const { validateQuestionInput } = require('../utils/questionValidation');

const router = express.Router();
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 20;

// The question bank holds correct answers, so only Contributors may use it (SRS Table 1).
router.use(requireAuth, requireRoles('contributor'), requireDatabase);

function toQuestionResponse(question) {
  return {
    id: question._id,
    text: question.text,
    options: question.options,
    correctIndex: question.correctIndex,
    topic: question.topic,
    difficulty: question.difficulty,
    ownerId: question.ownerId,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
  };
}

function parsePositiveInteger(value, fallback) {
  if (value == null || value === '') return fallback;
  return typeof value === 'string' && /^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : null;
}

router.post('/', async (req, res) => {
  const validation = validateQuestionInput(req.body);
  if (validation.error) return res.status(400).json({ message: validation.error });

  try {
    const question = await Question.create({ ...validation.value, ownerId: req.auth.sub });
    return res.status(201).json({ message: 'Question saved', question: toQuestionResponse(question) });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid question details' });
    }
    console.error('Saving question failed:', error.message);
    return res.status(500).json({ message: 'Unable to save question' });
  }
});

router.get('/', async (req, res) => {
  const page = parsePositiveInteger(req.query.page, 1);
  const limit = parsePositiveInteger(req.query.limit, DEFAULT_PAGE_SIZE);
  if (!page || !limit) return res.status(400).json({ message: 'Page and limit must be positive whole numbers' });
  const pageSize = Math.min(limit, MAX_PAGE_SIZE);
  const filter = {};

  try {
    const [questions, total] = await Promise.all([
      Question.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Question.countDocuments(filter),
    ]);
    return res.json({
      questions: questions.map(toQuestionResponse),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error('Listing questions failed:', error.message);
    return res.status(500).json({ message: 'Unable to list questions' });
  }
});

module.exports = router;
