const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const startedAt = new Date().toISOString();

const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptimeSeconds: process.uptime(),
    database: dbStates[mongoose.connection.readyState] || 'disconnected',
    startedAt,
    time: new Date().toISOString()
  });
});

module.exports = router;
