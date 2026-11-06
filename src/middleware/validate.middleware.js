const ApiError = require('../utils/ApiError');

const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const issues = result.error.issues || result.error.errors || [];
    const details = issues.map((err) => ({
      field: err.path.join('.'),
      message: err.message
    }));
    return next(ApiError.unprocessable('Validation failed', 'VALIDATION_ERROR', details));
  }
  req[source] = result.data;
  next();
};

module.exports = validate;

