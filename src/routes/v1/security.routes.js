const express = require('express');
const router = express.Router();
const SecurityController = require('../../controllers/security.controller');
const GatePassRequest = require('../../models/GatePassRequest.model');
const authenticate = require('../../middleware/authenticate.middleware');
const authorize = require('../../middleware/authorize.middleware');
const validate = require('../../middleware/validate.middleware');
const asyncHandler = require('../../utils/async-handler');
const { ROLES } = require('../../config/constants');
const { sendSuccess } = require('../../utils/response');
const {
  verifyGatePassSchema,
  gateAccessActionSchema,
  residentDecisionSchema
} = require('../../validators/gate-pass.schemas');
const { securityAccessRequestSchema } = require('../../validators/integration.schemas');

router.use(authenticate);

// Guard routes
router.post(
  '/access-requests',
  authorize(ROLES.SECURITY_GUARD, ROLES.SECURITY_ADMIN),
  validate(securityAccessRequestSchema),
  asyncHandler(SecurityController.registerArrival)
);

router.get(
  '/access-requests/:id',
  asyncHandler(async (req, res) => {
    const query = req.params.id.startsWith('GPR-') ? { publicId: req.params.id } : { _id: req.params.id };
    const request = await GatePassRequest.findOne(query).populate('issuedPassId');
    return sendSuccess(res, request, 200);
  })
);

router.post(
  '/gate-passes/verify',
  authorize(ROLES.SECURITY_GUARD, ROLES.SECURITY_ADMIN),
  validate(verifyGatePassSchema),
  asyncHandler(SecurityController.verifyPass)
);

router.post(
  '/gate-passes/:id/check-in',
  authorize(ROLES.SECURITY_GUARD, ROLES.SECURITY_ADMIN),
  validate(gateAccessActionSchema),
  asyncHandler(SecurityController.checkIn)
);

router.post(
  '/gate-passes/:id/check-out',
  authorize(ROLES.SECURITY_GUARD, ROLES.SECURITY_ADMIN),
  validate(gateAccessActionSchema),
  asyncHandler(SecurityController.checkOut)
);

// Resident decision route
router.post(
  '/resident/access-requests/:id/decision',
  authorize(ROLES.RESIDENT, ROLES.AGENCY_ADMIN, ROLES.SECURITY_ADMIN),
  validate(residentDecisionSchema),
  asyncHandler(SecurityController.recordResidentDecision)
);

module.exports = router;

