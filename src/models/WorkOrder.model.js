const { Schema, model } = require('mongoose');
const { WORK_ORDER_STATUS, PRIORITY } = require('../config/constants');

const workOrderSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true, index: true },
    caseOrderId: { type: String, index: true },
    title: { type: String, required: true, trim: true },
    instructions: { type: String, trim: true },
    agencyId: { type: String, default: 'AGENCY-01' },
    propertyId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: Object.values(WORK_ORDER_STATUS),
      default: WORK_ORDER_STATUS.OPEN,
      index: true
    },
    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.NORMAL },
    targetDate: { type: Date },
    assignmentIds: [{ type: Schema.Types.ObjectId, ref: 'WorkOrderAssignment' }],
    createdBy: { type: String, required: true },
    updatedBy: { type: String }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

workOrderSchema.index({ propertyId: 1, status: 1 });

module.exports = model('WorkOrder', workOrderSchema);

