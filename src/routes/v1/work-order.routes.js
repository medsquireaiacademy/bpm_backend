const express = require('express');
const router = express.Router();
const WorkOrderController = require('../../controllers/work-order.controller');
const authenticate = require('../../middleware/authenticate.middleware');
const authorize = require('../../middleware/authorize.middleware');
const validate = require('../../middleware/validate.middleware');
const asyncHandler = require('../../utils/async-handler');
const { ROLES } = require('../../config/constants');
const { addAssignmentSchema } = require('../../validators/work-order.schemas');

router.use(authenticate);

router.get(
  '/',
  authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR, ROLES.RWA_PRESIDENT),
  asyncHandler(WorkOrderController.list)
);

router.get(
  '/:id',
  authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR, ROLES.RWA_PRESIDENT),
  asyncHandler(WorkOrderController.getById)
);

router.post(
  '/:id/assignments',
  authorize(ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR),
  validate(addAssignmentSchema),
  asyncHandler(WorkOrderController.addAssignment)
);

module.exports = router;

