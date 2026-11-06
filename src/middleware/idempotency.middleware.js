const { sha256 } = require('../utils/crypto');
const IdempotencyRecord = require('../models/IdempotencyRecord.model');
const ApiError = require('../utils/ApiError');

const idempotency = ({ required = false, ttlMinutes = 60 * 24 } = {}) => async (req, res, next) => {
  const key = req.headers['idempotency-key'];
  if (!key) {
    if (required) {
      return next(ApiError.badRequest('Idempotency-Key header is required for this operation', 'MISSING_IDEMPOTENCY_KEY'));
    }
    return next();
  }

  const clientId = (req.user && req.user.userId) || (req.client && req.client.clientId) || req.ip;
  const requestHash = sha256(JSON.stringify(req.body || {}));

  try {
    const existing = await IdempotencyRecord.findOne({ clientId, idempotencyKey: key }).lean();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return next(ApiError.conflict('Idempotency key has already been used with a different request payload', 'IDEMPOTENCY_KEY_REUSED'));
      }
      return res.status(existing.responseStatus || 200).json(existing.responseBody);
    }

    // Intercept res.json to capture response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
        IdempotencyRecord.create({
          clientId,
          idempotencyKey: key,
          requestHash,
          responseStatus: res.statusCode,
          responseBody: body,
          expiresAt
        }).catch((err) => {
          console.error('[Idempotency] Failed to save record:', err.message);
        });
      }
      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = idempotency;

