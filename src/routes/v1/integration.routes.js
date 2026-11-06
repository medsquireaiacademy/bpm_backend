const express = require('express');
const router = express.Router();
const IntegrationController = require('../../controllers/integration.controller');
const authenticateClient = require('../../middleware/authenticate-client.middleware');
const validate = require('../../middleware/validate.middleware');
const idempotency = require('../../middleware/idempotency.middleware');
const asyncHandler = require('../../utils/async-handler');
const {
  residenceServiceRequestSchema,
  rwaComplaintSchema,
  residenceGatePassRequestSchema,
  securityAccessRequestSchema
} = require('../../validators/integration.schemas');

// Residence App Integration
router.post(
  '/residence/service-requests',
  authenticateClient('residence-api-client'),
  idempotency(),
  validate(residenceServiceRequestSchema),
  asyncHandler(IntegrationController.createResidenceServiceRequest)
);

router.get(
  '/residence/service-requests/:sourceRequestId',
  authenticateClient('residence-api-client'),
  asyncHandler(IntegrationController.getResidenceServiceRequest)
);

router.post(
  '/residence/gate-pass-requests',
  authenticateClient('residence-api-client'),
  idempotency(),
  validate(residenceGatePassRequestSchema),
  asyncHandler(IntegrationController.createResidenceGatePass)
);

// RWA App Integration
router.post(
  '/rwa/complaints',
  authenticateClient('rwa-api-client'),
  idempotency(),
  validate(rwaComplaintSchema),
  asyncHandler(IntegrationController.createRwaComplaint)
);

router.get(
  '/rwa/complaints/:sourceRequestId',
  authenticateClient('rwa-api-client'),
  asyncHandler(IntegrationController.getRwaComplaint)
);

// Security App Integration
router.post(
  '/security/access-requests',
  authenticateClient('security-api-client'),
  idempotency(),
  validate(securityAccessRequestSchema),
  asyncHandler(IntegrationController.createSecurityArrival)
);

module.exports = router;

