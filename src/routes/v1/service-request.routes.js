const express = require('express');
const router = express.Router();
const ServiceRequestController = require('../../controllers/service-request.controller');
const authenticate = require('../../middleware/authenticate.middleware');
const authorize = require('../../middleware/authorize.middleware');
const validate = require('../../middleware/validate.middleware');
const asyncHandler = require('../../utils/async-handler');
const { ROLES } = require('../../config/constants');
const { holdResumeSchema } = require('../../validators/service-request.schemas');

router.use(authenticate);

router.get('/', asyncHandler(ServiceRequestController.list));
router.get('/:id', asyncHandler(ServiceRequestController.getById));

// RWA / Admin Approvals
router.post(
  '/:id/approve',
  authorize(ROLES.RWA_PRESIDENT, ROLES.RWA_VICE_PRESIDENT, ROLES.AGENCY_ADMIN),
  asyncHandler(ServiceRequestController.approve)
);

router.post(
  '/:id/reject',
  authorize(ROLES.RWA_PRESIDENT, ROLES.RWA_VICE_PRESIDENT, ROLES.AGENCY_ADMIN),
  asyncHandler(ServiceRequestController.reject)
);

// Hold and Resume
router.post(
  '/:id/hold',
  authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR),
  validate(holdResumeSchema),
  asyncHandler(ServiceRequestController.hold)
);

router.post(
  '/:id/resume',
  authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR),
  asyncHandler(ServiceRequestController.resume)
);

// Resolution and Closure
router.post(
  '/:id/resolve',
  authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR),
  asyncHandler(ServiceRequestController.resolve)
);

router.post(
  '/:id/close',
  authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR, ROLES.RWA_PRESIDENT),
  asyncHandler(ServiceRequestController.close)
);

module.exports = router;

