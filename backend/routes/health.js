const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const startedAt = new Date().toISOString();
const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function healthHandler(req, res) {
  const mongoConfigured = Boolean(process.env.MONGO_URI);
  const readyState = mongoose.connection.readyState;
  const dbLabel = mongoConfigured
    ? (dbStates[readyState] || 'disconnected')
    : 'not configured';

  // When the app is configured to use MongoDB, report unready until it connects.
  const isDown = mongoConfigured && readyState !== 1;

  return res.status(isDown ? 503 : 200).json({
    status: isDown ? 'DOWN' : 'OK',
    uptimeSeconds: process.uptime(),
    database: dbLabel,
    startedAt,
    time: new Date().toISOString(),
  });
}

router.get('/api/health', healthHandler);
router.get('/health', healthHandler);

module.exports = router;
