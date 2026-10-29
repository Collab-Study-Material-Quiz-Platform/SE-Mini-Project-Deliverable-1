const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 100 },
    subject: { type: String, required: true, trim: true, maxlength: 100 },
    topic: { type: String, required: true, trim: true, maxlength: 100 },
    // Lower-case copies give case-insensitive exact filters that can still use an index.
    subjectKey: { type: String, required: true, select: false },
    topicKey: { type: String, required: true, select: false },
    originalName: { type: String, required: true },
    // Location in the server file store. Never sent to clients.
    storagePath: { type: String, required: true, select: false },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    downloadCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

materialSchema.pre('validate', function setFilterKeys() {
  if (typeof this.subject === 'string') this.subjectKey = this.subject.trim().toLowerCase();
  if (typeof this.topic === 'string') this.topicKey = this.topic.trim().toLowerCase();
});

// Search indexes (CSQ-F-011, CSQ-NF-001): keyword text search plus newest-first listing and exact filters.
materialSchema.index({ title: 'text', subject: 'text', topic: 'text' }, { name: 'material_text_search' });
materialSchema.index({ createdAt: -1, _id: -1 });
materialSchema.index({ subjectKey: 1, createdAt: -1 });
materialSchema.index({ topicKey: 1, createdAt: -1 });

module.exports = mongoose.model('Material', materialSchema);
