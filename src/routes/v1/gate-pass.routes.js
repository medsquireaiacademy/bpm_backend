const express = require('express');
const router = express.Router();
const GatePassController = require('../../controllers/gate-pass.controller');
const authenticate = require('../../middleware/authenticate.middleware');
const authorize = require('../../middleware/authorize.middleware');
const validate = require('../../middleware/validate.middleware');
const asyncHandler = require('../../utils/async-handler');
const { ROLES } = require('../../config/constants');
const { createGatePassRequestSchema } = require('../../validators/gate-pass.schemas');

router.use(authenticate);

// Pass requests
router.post(
  '/requests',
  validate(createGatePassRequestSchema),
  asyncHandler(GatePassController.createRequest)
);
router.get('/requests', asyncHandler(GatePassController.listRequests));
router.get('/requests/:id', asyncHandler(GatePassController.getRequestById));
router.post(
  '/requests/:id/approve',
  authorize(ROLES.RESIDENT, ROLES.SECURITY_ADMIN, ROLES.AGENCY_ADMIN),
  asyncHandler(GatePassController.approveRequest)
);
router.post(
  '/requests/:id/reject',
  authorize(ROLES.RESIDENT, ROLES.SECURITY_ADMIN, ROLES.AGENCY_ADMIN),
  asyncHandler(GatePassController.rejectRequest)
);

// Passes
router.get('/', asyncHandler(GatePassController.listPasses));
router.get('/:id', asyncHandler(GatePassController.getPassById));
router.post(
  '/:id/revoke',
  authorize(ROLES.RESIDENT, ROLES.SECURITY_ADMIN, ROLES.AGENCY_ADMIN),
  asyncHandler(GatePassController.revokePass)
);

module.exports = router;

