const { Schema, model } = require('mongoose');
const { GATE_PASS_REQUEST_STATUS } = require('../config/constants');

const gatePassRequestSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    source: {
      application: { type: String, required: true, default: 'RESIDENCE' },
      sourceRequestId: { type: String }
    },
    requestType: {
      type: String,
      required: true,
      enum: ['RESIDENT_GUEST', 'DELIVERY', 'CONTRACTOR', 'TECHNICIAN_WORK_ORDER', 'SECURITY_ARRIVAL'],
      index: true
    },
    propertyId: { type: String, required: true, index: true },
    householdId: { type: String, index: true },
    apartmentName: { type: String },
    flatNumber: { type: String },
    requestedBy: {
      userId: { type: String, required: true },
      name: { type: String },
      role: { type: String }
    },
    visitor: {
      name: { type: String, required: true, trim: true },
      phone: { type: String, trim: true },
      organization: { type: String, trim: true },
      category: { type: String },
      vehicleNumber: { type: String, trim: true },
      purpose: { type: String, trim: true }
    },
    technician: {
      technicianId: { type: String },
      workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder' },
      assignmentId: { type: Schema.Types.ObjectId, ref: 'WorkOrderAssignment' }
    },
    expectedAt: { type: Date },
    validFrom: { type: Date, default: Date.now },
    validUntil: { type: Date, required: true },
    accessGate: { type: String, default: 'Main Gate' },
    accessInstructions: { type: String },
    approval: {
      required: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
        default: 'NOT_REQUIRED'
      },
      approverId: { type: String },
      decidedAt: { type: Date },
      reason: { type: String }
    },
    status: {
      type: String,
      enum: Object.values(GATE_PASS_REQUEST_STATUS),
      default: GATE_PASS_REQUEST_STATUS.PENDING_APPROVAL,
      index: true
    },
    issuedPassId: { type: Schema.Types.ObjectId, ref: 'GatePass' }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gatePassRequestSchema.index({ propertyId: 1, status: 1 });
gatePassRequestSchema.index({ householdId: 1, createdAt: -1 });

module.exports = model('GatePassRequest', gatePassRequestSchema);

