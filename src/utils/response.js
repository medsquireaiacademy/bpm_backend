const sendSuccess = (res, data = null, statusCode = 200, meta = {}) => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: {
      requestId: res.req?.requestId || undefined,
      timestamp: new Date().toISOString(),
      ...meta
    }
  });
};

const sendError = (res, error, req = null) => {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message || 'An unexpected error occurred.',
      details: error.details || undefined
    },
    meta: {
      requestId: req?.requestId || res.req?.requestId || undefined,
      timestamp: new Date().toISOString()
    }
  });
};

module.exports = { sendSuccess, sendError };

