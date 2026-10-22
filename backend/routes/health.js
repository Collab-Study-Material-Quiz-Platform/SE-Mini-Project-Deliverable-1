const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

router.get('/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.status(200).json({
    status: 'OK',
    uptimeSeconds: Math.round(process.uptime()),
    database: dbStates[mongoose.connection.readyState],
    time: new Date().toISOString()
  });
});

module.exports = router;
