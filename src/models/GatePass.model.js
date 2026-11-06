const { Schema, model } = require('mongoose');
const { GATE_PASS_STATUS } = require('../config/constants');

const gatePassSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    passType: {
      type: String,
      required: true,
      enum: ['GUEST', 'DELIVERY', 'CONTRACTOR', 'TECHNICIAN'],
      index: true
    },
    requestId: { type: Schema.Types.ObjectId, ref: 'GatePassRequest' },
    sourceApplication: { type: String, default: 'RESIDENCE' },
    propertyId: { type: String, required: true, index: true },
    householdId: { type: String, index: true },
    apartmentName: { type: String },
    flatNumber: { type: String },
    linkedWorkOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', index: true },
    linkedAssignmentId: { type: Schema.Types.ObjectId, ref: 'WorkOrderAssignment' },
    visitor: {
      name: { type: String, required: true },
      phoneSnapshot: { type: String },
      organization: { type: String },
      vehicleNumber: { type: String },
      purpose: { type: String }
    },
    technician: {
      technicianId: { type: String },
      nameSnapshot: { type: String },
      phoneSnapshot: { type: String }
    },
    validFrom: { type: Date, required: true, default: Date.now },
    validUntil: { type: Date, required: true, index: true },
    accessGate: { type: String, default: 'Main Gate' },
    accessInstructions: { type: String },
    status: {
      type: String,
      enum: Object.values(GATE_PASS_STATUS),
      default: GATE_PASS_STATUS.ACTIVE,
      index: true
    },
    tokenHash: { type: String, required: true, unique: true, index: true },
    otpHash: { type: String, index: true },
    usagePolicy: {
      type: String,
      enum: ['SINGLE_ENTRY', 'MULTI_ENTRY_WITHIN_WINDOW'],
      default: 'SINGLE_ENTRY'
    },
    maxEntries: { type: Number, default: 1 },
    entryCount: { type: Number, default: 0 },
    issuedBy: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    revokedBy: { type: String },
    revokedAt: { type: Date },
    revokeReason: { type: String }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gatePassSchema.index({ propertyId: 1, status: 1, validUntil: 1 });

module.exports = model('GatePass', gatePassSchema);

