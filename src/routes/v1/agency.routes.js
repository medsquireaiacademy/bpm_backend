const express = require('express');
const router = express.Router();
const AgencyController = require('../../controllers/agency.controller');
const authenticate = require('../../middleware/authenticate.middleware');
const authorize = require('../../middleware/authorize.middleware');
const validate = require('../../middleware/validate.middleware');
const idempotency = require('../../middleware/idempotency.middleware');
const asyncHandler = require('../../utils/async-handler');
const { ROLES } = require('../../config/constants');
const { dispatchSchema } = require('../../validators/work-order.schemas');

router.use(authenticate);
router.use(authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR));

router.get('/service-requests', asyncHandler(AgencyController.getQueue));
router.get('/service-requests/:id', asyncHandler(AgencyController.getRequestDetails));
router.post(
  '/service-requests/:id/dispatch',
  idempotency(),
  validate(dispatchSchema),
  asyncHandler(AgencyController.dispatch)
);
router.get('/technicians', asyncHandler(AgencyController.listTechnicians));

module.exports = router;

