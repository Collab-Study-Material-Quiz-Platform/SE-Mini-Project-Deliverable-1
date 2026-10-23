const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const startedAt = new Date().toISOString();

const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

function healthHandler(req, res) {
  const mongoConfigured = !!process.env.MONGO_URI;
  const readyState = mongoose.connection.readyState;
  const dbLabel = mongoConfigured
    ? (dbStates[readyState] || 'disconnected')
    : 'not configured';

  // 503 only when MONGO_URI is set but the DB is not connected
  const isDown = mongoConfigured && readyState !== 1;
  const httpStatus = isDown ? 503 : 200;
  const statusLabel = isDown ? 'DOWN' : 'OK';

  res.status(httpStatus).json({
    status: statusLabel,
    uptimeSeconds: process.uptime(),
    database: dbLabel,
    startedAt,
    time: new Date().toISOString(),
  });
}

// Primary route per SAD
router.get('/api/health', healthHandler);

// Alias kept for backwards compatibility
router.get('/health', healthHandler);

module.exports = router;
