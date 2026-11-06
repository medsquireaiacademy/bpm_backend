const { z } = require('zod');

const createGatePassRequestSchema = z.object({
  requestType: z.enum(['RESIDENT_GUEST', 'DELIVERY', 'CONTRACTOR', 'TECHNICIAN_WORK_ORDER', 'SECURITY_ARRIVAL']),
  propertyId: z.string().min(1, 'propertyId is required'),
  householdId: z.string().optional(),
  flatNumber: z.string().optional(),
  visitor: z.object({
    name: z.string().min(1, 'Visitor name is required'),
    phone: z.string().optional(),
    organization: z.string().optional(),
    vehicleNumber: z.string().optional(),
    purpose: z.string().optional()
  }),
  expectedAt: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().min(1, 'validUntil is required'),
  accessGate: z.string().optional().default('Main Gate'),
  accessInstructions: z.string().optional()
});

const verifyGatePassSchema = z.object({
  token: z.string().optional(),
  otp: z.string().optional(),
  gateId: z.string().optional().default('Main Gate'),
  propertyId: z.string().optional()
}).refine(data => data.token || data.otp, {
  message: 'Either token (QR string) or OTP must be provided'
});

const gateAccessActionSchema = z.object({
  gateId: z.string().optional().default('Main Gate'),
  remarks: z.string().optional()
});

const residentDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional()
});

module.exports = {
  createGatePassRequestSchema,
  verifyGatePassSchema,
  gateAccessActionSchema,
  residentDecisionSchema
};

