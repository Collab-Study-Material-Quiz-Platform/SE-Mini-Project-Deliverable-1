const express = require('express');
const mongoose = require('mongoose');
const Question = require('../models/Question');
const { requireAuth } = require('../utils/authToken');
const { requireRoles } = require('../middleware/authorization');
const { requireDatabase } = require('../middleware/database');
const { validateQuestionInput, parseQuestionFilter } = require('../utils/questionValidation');
const { isQuestionInPublishedQuiz } = require('../utils/questionUsage');

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

// Loads the question and checks server-side that the logged-in Contributor created it.
// Sends the error response and returns null when the question is missing or owned by someone else.
async function findOwnQuestion(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Question not found' });
    return null;
  }
  const question = await Question.findById(req.params.id);
  if (!question) {
    res.status(404).json({ message: 'Question not found' });
    return null;
  }
  if (question.ownerId.toString() !== req.auth.sub) {
    res.status(403).json({ message: 'Access denied' });
    return null;
  }
  return question;
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
  const parsed = parseQuestionFilter(req.query);
  if (parsed.error) return res.status(400).json({ message: parsed.error });
  const filter = parsed.value;

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

router.put('/:id', async (req, res) => {
  try {
    const question = await findOwnQuestion(req, res);
    if (!question) return undefined;

    const validation = validateQuestionInput(req.body);
    if (validation.error) return res.status(400).json({ message: validation.error });

    question.set(validation.value);
    await question.save();
    return res.json({ message: 'Question updated', question: toQuestionResponse(question) });
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: 'Invalid question details' });
    console.error('Updating question failed:', error.message);
    return res.status(500).json({ message: 'Unable to update question' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const question = await findOwnQuestion(req, res);
    if (!question) return undefined;

    if (await isQuestionInPublishedQuiz(question._id)) {
      return res.status(409).json({ message: 'Question is in use' });
    }

    await Question.deleteOne({ _id: question._id });
    return res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('Deleting question failed:', error.message);
    return res.status(500).json({ message: 'Unable to delete question' });
  }
});

module.exports = router;
