const mongoose = require('mongoose');

const quizAttemptSchema = new mongoose.Schema(
  {
    quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    startedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    submittedAt: { type: Date },
    status: { type: String, enum: ['in_progress', 'submitted', 'timed_out'], default: 'in_progress', required: true },
    answers: { type: Map, of: { type: Number, min: 0, max: 3, validate: Number.isInteger }, default: () => new Map() },
  },
  { timestamps: true }
);

quizAttemptSchema.index({ studentId: 1, quizId: 1, createdAt: -1 });
quizAttemptSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
