const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { sendSuccess } = require('../../utils/response');

router.get('/live', (req, res) => {
  return sendSuccess(res, { status: 'UP', timestamp: new Date().toISOString() });
});

router.get('/ready', (req, res) => {
  const isDbReady = mongoose.connection.readyState === 1;
  const status = isDbReady ? 'READY' : 'DEGRADED';
  const statusCode = isDbReady ? 200 : 503;

  return res.status(statusCode).json({
    status,
    database: isDbReady ? 'CONNECTED' : 'DISCONNECTED',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

module.exports = router;

