const { z } = require('zod');

const assignmentInputSchema = z.object({
  technicianId: z.string().min(1, 'technicianId is required'),
  technicianName: z.string().optional(),
  role: z.string().min(1, 'role is required'),
  skill: z.string().optional(),
  instructions: z.string().optional(),
  targetDate: z.string().optional()
});

const dispatchSchema = z.object({
  caseOrderId: z.string().optional(),
  targetDate: z.string().optional(),
  instructions: z.string().optional(),
  assignments: z.array(assignmentInputSchema).min(1, 'At least one technician assignment is required'),
  createTechnicianGatePass: z.boolean().optional().default(false)
});

const addAssignmentSchema = assignmentInputSchema;

const updateAssignmentSchema = z.object({
  technicianId: z.string().optional(),
  technicianName: z.string().optional(),
  role: z.string().optional(),
  instructions: z.string().optional(),
  targetDate: z.string().optional(),
  status: z.string().optional()
});

module.exports = {
  dispatchSchema,
  addAssignmentSchema,
  updateAssignmentSchema
};

