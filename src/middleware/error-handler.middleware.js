const { sendError } = require('../utils/response');
const { NODE_ENV } = require('../config/env');

const errorHandler = (err, req, res, next) => {
  if (NODE_ENV !== 'production' && !err.statusCode) {
    console.error(`[Error] Unhandled Exception at ${req.method} ${req.url}:`, err);
  }

  // Handle Mongoose duplicate key errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(
      res,
      {
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message: `A record with this ${field} already exists.`
      },
      req
    );
  }

  // Handle CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    return sendError(
      res,
      {
        statusCode: 400,
        code: 'INVALID_ID',
        message: `Invalid format for identifier: ${err.value}`
      },
      req
    );
  }

  return sendError(res, err, req);
};

module.exports = errorHandler;

