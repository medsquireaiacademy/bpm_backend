const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  API_PREFIX: process.env.API_PREFIX || '/api/v1',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bee_property_db',
  MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || 'bee_property',
  JWT_SECRET: process.env.JWT_SECRET || 'bee_super_secret_jwt_key_change_in_production_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'bee_refresh_secret_key_change_in_production_2026',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  WEBHOOK_SIGNING_SECRET: process.env.WEBHOOK_SIGNING_SECRET || 'bee_webhook_signing_secret_2026',
  RESIDENCE_WEBHOOK_URL: process.env.RESIDENCE_WEBHOOK_URL || '',
  RWA_WEBHOOK_URL: process.env.RWA_WEBHOOK_URL || '',
  AGENCY_WEBHOOK_URL: process.env.AGENCY_WEBHOOK_URL || '',
  TECHNICIAN_WEBHOOK_URL: process.env.TECHNICIAN_WEBHOOK_URL || '',
  SECURITY_WEBHOOK_URL: process.env.SECURITY_WEBHOOK_URL || ''
};

