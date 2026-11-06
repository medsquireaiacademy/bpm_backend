const { z } = require('zod');
const { SERVICE_REQUEST_STATUS } = require('../config/constants');

const approvalSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional()
});

const statusUpdateSchema = z.object({
  status: z.enum(Object.values(SERVICE_REQUEST_STATUS)),
  reason: z.string().optional()
});

const holdResumeSchema = z.object({
  reason: z.string().min(1, 'Reason is required')
});

module.exports = {
  approvalSchema,
  statusUpdateSchema,
  holdResumeSchema
};

