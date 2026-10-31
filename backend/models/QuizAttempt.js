const mongoose = require('mongoose');

// A snapshot taken at grading time, so later edits to a question do not change a past result.
const resultQuestionSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    text: { type: String, required: true },
    options: [{ type: String }],
    selectedIndex: { type: Number, default: null },
    correctIndex: { type: Number, default: null },
    correct: { type: Boolean, required: true },
    topic: { type: String, default: '' },
  },
  { _id: false }
);

const attemptResultSchema = new mongoose.Schema(
  {
    score: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    gradedAt: { type: Date, required: true },
    questions: [resultQuestionSchema],
  },
  { _id: false }
);

const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    submittedAt: { type: Date },
    status: { type: String, enum: ['in_progress', 'submitted', 'timed_out'], default: 'in_progress', required: true },
    answers: { type: Map, of: { type: Number, min: 0, max: 3, validate: Number.isInteger }, default: () => new Map() },
    result: { type: attemptResultSchema, default: undefined },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ studentId: 1, quizId: 1, createdAt: -1 });
quizAttemptSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
