const express = require('express');
const router = express.Router();
const TechnicianController = require('../../controllers/technician.controller');
const authenticate = require('../../middleware/authenticate.middleware');
const authorize = require('../../middleware/authorize.middleware');
const validate = require('../../middleware/validate.middleware');
const asyncHandler = require('../../utils/async-handler');
const { ROLES } = require('../../config/constants');
const {
  technicianCheckInSchema,
  technicianNoteSchema,
  technicianAttachmentSchema,
  technicianHoldSchema,
  technicianCompleteSchema
} = require('../../validators/technician.schemas');

router.use(authenticate);
router.use(authorize(ROLES.TECHNICIAN, ROLES.AGENCY_ADMIN, ROLES.AGENCY_SUPERVISOR));

router.get('/jobs', asyncHandler(TechnicianController.listJobs));
router.get('/jobs/:jobId', asyncHandler(TechnicianController.getJobById));
router.post(
  '/jobs/:jobId/check-in',
  validate(technicianCheckInSchema),
  asyncHandler(TechnicianController.checkIn)
);
router.post(
  '/jobs/:jobId/notes',
  validate(technicianNoteSchema),
  asyncHandler(TechnicianController.addNote)
);
router.post(
  '/jobs/:jobId/attachments',
  validate(technicianAttachmentSchema),
  asyncHandler(TechnicianController.addAttachment)
);
router.post(
  '/jobs/:jobId/hold',
  validate(technicianHoldSchema),
  asyncHandler(TechnicianController.hold)
);
router.post('/jobs/:jobId/resume', asyncHandler(TechnicianController.resume));
router.post(
  '/jobs/:jobId/complete',
  validate(technicianCompleteSchema),
  asyncHandler(TechnicianController.complete)
);
router.get('/jobs/:jobId/gate-pass', asyncHandler(TechnicianController.getGatePass));

module.exports = router;

