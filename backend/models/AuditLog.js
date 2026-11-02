const mongoose = require('mongoose');

/**
 * AuditLog — append-only audit log for CSQ-SR-006 / SAD DS-Sec-06.
 *
 * Records the user ID, action and date/time for every login (success or
 * failure), upload and deletion.  There is intentionally no update or
 * delete helper for audit entries — the collection is write-once.
 */
const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    action: {
      type: String,
      enum: ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'UPLOAD', 'DELETE'],
      required: true,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
  },
  {
    // Use "timestamp" (not createdAt) to match the SAD wording and so the
    // field name is explicit in query results.
    timestamps: { createdAt: 'timestamp', updatedAt: false },
  }
);

auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ userId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema, 'audit_logs');
