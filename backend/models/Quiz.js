const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 200 },
    timeLimitMinutes: { type: Number, required: true, min: 5, max: 180, validate: Number.isInteger },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true }],
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', required: true },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

quizSchema.path('questionIds').validate(ids => ids.length >= 5 && ids.length <= 50, 'Quiz must contain 5 to 50 questions');
quizSchema.index({ status: 1, createdAt: -1 });
quizSchema.index({ creatorId: 1, createdAt: -1 });

module.exports = mongoose.model('Quiz', quizSchema);
