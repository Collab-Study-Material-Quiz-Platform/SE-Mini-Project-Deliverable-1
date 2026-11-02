const AuditLog = require('../models/AuditLog');

/**
 * Write a single append-only audit-log entry (CSQ-SR-006 / SAD DS-Sec-06).
 *
 * @param {Object} entry
 * @param {string|null} entry.userId   - The acting user's ObjectId (or null for unknown email login).
 * @param {string} entry.action        - One of LOGIN_SUCCESS, LOGIN_FAILED, UPLOAD, DELETE.
 * @param {string|null} [entry.targetId] - The id of the affected document (material id, question id, etc.).
 * @param {string|null} [entry.ipAddress] - The client IP from the request.
 *
 * The function never throws. If the write fails it logs the error to the
 * application log (console.error) and continues — the user's request is
 * never broken by an audit-log failure.  No password, token or request
 * body is ever stored; only userId, action, targetId and ipAddress.
 */
async function writeAudit({ userId, action, targetId, ipAddress }) {
  try {
    await AuditLog.create({ userId, action, targetId, ipAddress });
  } catch (error) {
    console.error('Audit log write failed:', error.message);
  }
}

module.exports = { writeAudit };
