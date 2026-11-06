const { Schema, model } = require('mongoose');
const { SERVICE_REQUEST_STATUS, PRIORITY, SOURCES } = require('../config/constants');

const serviceRequestSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    source: {
      application: { type: String, required: true, enum: Object.values(SOURCES), index: true },
      sourceRequestId: { type: String, required: true, index: true },
      sourceStatus: { type: String },
      sourceCreatedAt: { type: Date }
    },
    property: {
      propertyId: { type: String, required: true, index: true },
      householdId: { type: String, index: true },
      apartmentName: { type: String, trim: true },
      tower: { type: String, trim: true },
      floor: { type: String, trim: true },
      flatNumber: { type: String, trim: true },
      placeName: { type: String, trim: true },
      asset: { type: String, trim: true },
      complaintScope: { type: String, default: 'INDIVIDUAL_UNIT' }
    },
    requester: {
      userId: { type: String, required: true, index: true },
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      role: { type: String }
    },
    classification: {
      category: { type: String, required: true, index: true },
      issueType: { type: String },
      serviceType: { type: String }
    },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: Object.values(PRIORITY), default: PRIORITY.NORMAL, index: true },
    status: {
      type: String,
      enum: Object.values(SERVICE_REQUEST_STATUS),
      default: SERVICE_REQUEST_STATUS.PENDING,
      index: true
    },
    approval: {
      required: { type: Boolean, default: false },
      status: {
        type: String,
        enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
        default: 'NOT_REQUIRED'
      },
      approvedBy: { type: String },
      approvedAt: { type: Date },
      reason: { type: String }
    },
    preferredSchedule: {
      date: { type: String },
      timeSlot: { type: String }
    },
    attachments: [
      {
        attachmentId: { type: String },
        kind: { type: String, default: 'ISSUE' },
        storageKey: { type: String },
        url: { type: String },
        fileName: { type: String },
        mimeType: { type: String },
        sizeBytes: { type: Number },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    workOrderIds: [{ type: Schema.Types.ObjectId, ref: 'WorkOrder' }],
    history: [
      {
        action: { type: String, required: true },
        fromStatus: { type: String },
        toStatus: { type: String },
        performedBy: { type: String, required: true },
        reason: { type: String },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  {
    timestamps: true,
    versionKey: false
  }
);

serviceRequestSchema.index({ 'source.application': 1, 'source.sourceRequestId': 1 }, { unique: true });
serviceRequestSchema.index({ 'property.propertyId': 1, status: 1 });
serviceRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = model('ServiceRequest', serviceRequestSchema);

