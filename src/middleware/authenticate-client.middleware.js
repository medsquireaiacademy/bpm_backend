const ApiError = require('../utils/ApiError');

const KNOWN_CLIENTS = {
  'residence-api-client': process.env.RESIDENCE_CLIENT_SECRET || 'residence_secret_2026',
  'rwa-api-client': process.env.RWA_CLIENT_SECRET || 'rwa_secret_2026',
  'agency-portal-client': process.env.AGENCY_CLIENT_SECRET || 'agency_secret_2026',
  'technician-app-client': process.env.TECHNICIAN_CLIENT_SECRET || 'technician_secret_2026',
  'security-api-client': process.env.SECURITY_CLIENT_SECRET || 'security_secret_2026',
  'dotnet-backend-client': process.env.DOTNET_CLIENT_SECRET || 'dotnet_secret_2026'
};

const authenticateClient = (expectedClientId = null) => (req, res, next) => {
  const clientId = req.headers['x-client-id'] || (req.user && req.user.clientId);
  const clientSecret = req.headers['x-client-secret'];

  // If user is already authenticated via JWT with system/service role, allow through
  if (req.user && (req.user.role === 'SYSTEM_CLIENT' || req.user.clientId)) {
    if (expectedClientId && req.user.clientId && req.user.clientId !== expectedClientId) {
      return next(ApiError.forbidden(`Client ${req.user.clientId} is not authorized for this endpoint`));
    }
    return next();
  }

  // Otherwise check X-Client-Id and X-Client-Secret
  if (!clientId || !clientSecret) {
    // If JWT user exists with required permissions, proceed
    if (req.user) {
      return next();
    }
    return next(ApiError.unauthorized('Machine client credentials (X-Client-Id & X-Client-Secret) or Bearer token required', 'UNAUTHENTICATED_CLIENT'));
  }

  const expectedSecret = KNOWN_CLIENTS[clientId];
  if (!expectedSecret || expectedSecret !== clientSecret) {
    return next(ApiError.unauthorized('Invalid machine client credentials', 'INVALID_CLIENT_CREDENTIALS'));
  }

  if (expectedClientId && clientId !== expectedClientId) {
    return next(ApiError.forbidden(`Client '${clientId}' is not authorized for this route`));
  }

  req.client = { clientId };
  req.user = req.user || {
    userId: clientId,
    name: clientId,
    role: 'SYSTEM_CLIENT',
    propertyId: req.headers['x-property-id'] || 'ALL'
  };

  next();
};

module.exports = authenticateClient;

