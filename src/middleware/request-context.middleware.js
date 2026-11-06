const crypto = require('crypto');

const requestContext = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.correlationId = req.headers['x-correlation-id'] || req.requestId;
  res.setHeader('X-Request-Id', req.requestId);
  req.startedAt = Date.now();
  next();
};

module.exports = requestContext;

