const { Schema, model } = require('mongoose');
const { ASSIGNMENT_STATUS } = require('../config/constants');

const workOrderAssignmentSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    serviceOrderId: { type: String, required: true, unique: true, index: true },
    workOrderId: { type: Schema.Types.ObjectId, ref: 'WorkOrder', required: true, index: true },
    serviceRequestId: { type: Schema.Types.ObjectId, ref: 'ServiceRequest', required: true, index: true },
    technicianId: { type: String, required: true, index: true },
    technicianName: { type: String, trim: true },
    role: { type: String, required: true },
    skillSnapshot: { type: String },
    instructions: { type: String, trim: true },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.ASSIGNED,
      index: true
    },
    assignedAt: { type: Date, default: Date.now },
    targetDate: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    hold: {
      reason: { type: String },
      createdAt: { type: Date },
      createdBy: { type: String }
    },
    materialRequests: [
      {
        itemId: { type: String },
        name: { type: String },
        quantity: { type: Number, default: 1 },
        status: { type: String, default: 'PENDING' }
      }
    ],
    checkIn: {
      at: { type: Date },
      latitude: { type: Number },
      longitude: { type: Number },
      evidenceKey: { type: String }
    },
    checkOut: {
      at: { type: Date },
      latitude: { type: Number },
      longitude: { type: Number }
    },
    notes: [
      {
        noteId: { type: String, required: true },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: String, required: true }
      }
    ],
    beforePhotos: [
      {
        attachmentId: { type: String },
        url: { type: String },
        caption: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    afterPhotos: [
      {
        attachmentId: { type: String },
        url: { type: String },
        caption: { type: String },
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true,
    versionKey: false
  }
);

workOrderAssignmentSchema.index({ technicianId: 1, status: 1 });

module.exports = model('WorkOrderAssignment', workOrderAssignmentSchema);

