const ApiError = require('../utils/ApiError');

const createRateLimiter = ({ windowMs = 60 * 1000, max = 100, message = 'Too many requests, please try again later.' } = {}) => {
  const requests = new Map();

  // Periodic cleanup every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of requests.entries()) {
      if (now - record.resetTime > windowMs) {
        requests.delete(key);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const key = `${ip}:${req.baseUrl || req.path}`;
    const now = Date.now();

    let record = requests.get(key);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      requests.set(key, record);
    } else {
      record.count += 1;
    }

    if (record.count > max) {
      res.setHeader('Retry-After', Math.ceil((record.resetTime - now) / 1000));
      return next(ApiError.badRequest(message, 'RATE_LIMITED'));
    }

    next();
  };
};

module.exports = createRateLimiter;

