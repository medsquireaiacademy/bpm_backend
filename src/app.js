const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');

const { CORS_ORIGIN, API_PREFIX } = require('./config/env');
const requestContext = require('./middleware/request-context.middleware');
const notFound = require('./middleware/not-found.middleware');
const errorHandler = require('./middleware/error-handler.middleware');
const v1Router = require('./routes/v1/index.routes');
const healthRoutes = require('./routes/v1/health.routes');
const { sendSuccess } = require('./utils/response');

const app = express();

// Security and standard middlewares
app.use(helmet());
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestContext);

// Request Logger in non-test mode
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${duration}ms) [${req.requestId}]`);
    });
    next();
  });
}

// Interactive Swagger / OpenAPI Documentation
try {
  const swaggerDocument = YAML.load(path.join(__dirname, 'docs', 'openapi.yaml'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use(`${API_PREFIX}/docs`, swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (err) {
  console.warn('[Swagger] Documentation file could not be loaded:', err.message);
}

// Root welcome endpoint
app.get('/', (req, res) => {
  return sendSuccess(res, {
    name: 'BEE Property Service & Access API',
    version: '1.0.0',
    status: 'ACTIVE',
    documentation: '/docs',
    apiPrefix: API_PREFIX
  });
});

// Health routes
app.use('/health', healthRoutes);

// Uploads mock presign endpoint
app.post(`${API_PREFIX}/uploads/presign`, (req, res) => {
  const { fileName = 'file.jpg', fileType = 'image/jpeg' } = req.body || {};
  const fileKey = `uploads/${Date.now()}-${fileName}`;
  return sendSuccess(res, {
    uploadUrl: `https://storage.beeproperty.example/${fileKey}?signature=mock_presigned_url`,
    fileKey,
    mimeType: fileType,
    expiresInSeconds: 900
  });
});

// Mount V1 API routes
app.use(API_PREFIX, v1Router);

// 404 & Central Error Handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;

