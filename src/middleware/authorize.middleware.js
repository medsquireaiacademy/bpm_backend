const ApiError = require('../utils/ApiError');

const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(ApiError.unauthorized('Authentication required', 'UNAUTHENTICATED'));
  }

  // System clients can bypass role restrictions if designated as SYSTEM_CLIENT
  if (req.user.role === 'SYSTEM_CLIENT') {
    return next();
  }

  if (allowedRoles.length && !allowedRoles.includes(req.user.role)) {
    return next(
      ApiError.forbidden(
        `User role '${req.user.role}' is not authorized to access this resource`,
        'FORBIDDEN'
      )
    );
  }

  next();
};

module.exports = authorize;

