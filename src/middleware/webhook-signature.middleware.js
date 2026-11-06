const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const { WEBHOOK_SIGNING_SECRET } = require('../config/env');

const verifyWebhookSignature = ({ maxAgeSeconds = 300 } = {}) => (req, res, next) => {
  const signature = req.headers['x-bee-signature'];
  const timestamp = req.headers['x-bee-timestamp'];

  if (!signature || !timestamp) {
    return next(
      ApiError.unauthorized('Missing webhook signature or timestamp headers (X-Bee-Signature, X-Bee-Timestamp)', 'MISSING_SIGNATURE')
    );
  }

  // Prevent replay attacks (reject if timestamp is older than maxAgeSeconds)
  const reqTime = parseInt(timestamp, 10);
  const now = Date.now();
  if (isNaN(reqTime) || Math.abs(now - reqTime) > maxAgeSeconds * 1000) {
    return next(ApiError.unauthorized('Webhook timestamp is expired or too far in the future', 'EXPIRED_TIMESTAMP'));
  }

  const rawPayload = `${timestamp}.${JSON.stringify(req.body || {})}`;
  const expectedSignature = crypto.createHmac('sha256', WEBHOOK_SIGNING_SECRET).update(rawPayload).digest('hex');

  // Constant-time buffer comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return next(ApiError.unauthorized('Invalid webhook HMAC signature', 'INVALID_SIGNATURE'));
  }

  next();
};

module.exports = verifyWebhookSignature;

