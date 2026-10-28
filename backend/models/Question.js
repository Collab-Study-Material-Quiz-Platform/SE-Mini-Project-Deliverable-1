const mongoose = require('mongoose');
const { DIFFICULTIES, OPTION_COUNT } = require('../utils/questionValidation');

const questionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true, maxlength: 500 },
    options: {
      type: [{ type: String, trim: true, maxlength: 200 }],
      validate: {
        validator: options => options.length === OPTION_COUNT && options.every(Boolean),
        message: 'Exactly four options are required',
      },
    },
    // Index of the single correct option, so a question can never have more than one correct answer.
    correctIndex: { type: Number, required: true, min: 0, max: OPTION_COUNT - 1, validate: Number.isInteger },
    topic: { type: String, required: true, trim: true, maxlength: 100 },
    // Lower-case copy for case-insensitive topic filters.
    topicKey: { type: String, required: true, select: false },
    difficulty: { type: String, required: true, enum: DIFFICULTIES },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

questionSchema.pre('validate', function setTopicKey() {
  if (typeof this.topic === 'string') this.topicKey = this.topic.trim().toLowerCase();
});

// Filtering by topic, difficulty or both (CSQ-F-022), newest first; ownerId supports ownership lookups.
questionSchema.index({ topicKey: 1, difficulty: 1, createdAt: -1 });
questionSchema.index({ difficulty: 1, createdAt: -1 });
questionSchema.index({ ownerId: 1 });

module.exports = mongoose.model('Question', questionSchema);
