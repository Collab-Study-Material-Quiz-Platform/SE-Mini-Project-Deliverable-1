const mongoose = require('mongoose');

function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ message: 'Database unavailable' });
  }
  return next();
}

module.exports = { requireDatabase };
