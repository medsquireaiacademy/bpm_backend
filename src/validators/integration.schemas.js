const { z } = require('zod');

const residenceServiceRequestSchema = z.object({
  sourceRequestId: z.string().min(1, 'sourceRequestId is required'),
  householdId: z.string().min(1, 'householdId is required'),
  requesterId: z.string().min(1, 'requesterId is required'),
  requesterName: z.string().optional(),
  requesterPhone: z.string().optional(),
  location: z.object({
    propertyId: z.string().optional(),
    apartmentId: z.string().optional(),
    apartmentName: z.string().optional(),
    towerId: z.string().optional().nullable(),
    towerName: z.string().optional().nullable(),
    tower: z.string().optional().nullable(),
    flatNumber: z.string().optional(),
    floor: z.union([z.string(), z.number()]).optional()
  }).passthrough().optional().default({}),
  category: z.string().min(1, 'category is required'),
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  urgency: z.string().optional(),
  priority: z.string().optional(),
  preferredDate: z.string().optional(),
  preferredTimeSlot: z.string().optional(),
  attachments: z.array(z.any()).optional().default([])
});

const rwaComplaintSchema = z.object({
  sourceRequestId: z.string().min(1, 'sourceRequestId is required'),
  propertyId: z.string().optional(),
  apartmentId: z.string().optional(),
  apartmentName: z.string().optional(),
  location: z.object({
    towerId: z.string().optional().nullable(),
    towerName: z.string().optional().nullable(),
    floor: z.union([z.string(), z.number()]).optional().nullable(),
    placeName: z.string().optional().nullable(),
    asset: z.string().optional().nullable(),
    description: z.string().optional().nullable()
  }).optional().default({}),
  category: z.string().min(1, 'category is required'),
  issueType: z.string().optional(),
  title: z.string().min(1, 'title is required'),
  description: z.string().min(1, 'description is required'),
  priority: z.string().optional(),
  complaintScope: z.string().optional(),
  requiresApproval: z.boolean().optional().default(false),
  submittedById: z.string().optional(),
  submittedByRole: z.string().optional(),
  attachments: z.array(z.any()).optional().default([])
});

const residenceGatePassRequestSchema = z.object({
  sourceRequestId: z.string().optional(),
  propertyId: z.string().optional(),
  householdId: z.string().optional(),
  flatNumber: z.string().optional(),
  visitor: z.object({
    name: z.string().min(1, 'Visitor name is required'),
    phone: z.string().optional(),
    organization: z.string().optional(),
    category: z.string().optional(),
    vehicleNumber: z.string().optional(),
    purpose: z.string().optional()
  }),
  expectedAt: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().min(1, 'validUntil is required'),
  accessGate: z.string().optional().default('Main Gate'),
  accessInstructions: z.string().optional()
});

const securityAccessRequestSchema = z.object({
  visitorName: z.string().min(1, 'Visitor name is required'),
  phone: z.string().optional(),
  vehicleNumber: z.string().optional(),
  purpose: z.string().optional(),
  category: z.string().optional().default('VISITOR'),
  propertyId: z.string().optional(),
  flatNumber: z.string().min(1, 'Target flatNumber is required'),
  gateId: z.string().optional().default('Main Gate')
});

module.exports = {
  residenceServiceRequestSchema,
  rwaComplaintSchema,
  residenceGatePassRequestSchema,
  securityAccessRequestSchema
};
