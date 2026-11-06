const { Schema, model } = require('mongoose');
const { GATE_ACCESS_EVENT } = require('../config/constants');

const gateAccessEventSchema = new Schema(
  {
    passId: { type: Schema.Types.ObjectId, ref: 'GatePass', index: true },
    passPublicId: { type: String, index: true },
    propertyId: { type: String, required: true, index: true },
    gateId: { type: String, default: 'Main Gate', index: true },
    guardId: { type: String, required: true, index: true },
    guardName: { type: String },
    eventType: {
      type: String,
      required: true,
      enum: Object.values(GATE_ACCESS_EVENT),
      index: true
    },
    decisionCode: { type: String, required: true },
    occurredAt: { type: Date, default: Date.now, index: true },
    metadata: { type: Schema.Types.Mixed }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

gateAccessEventSchema.index({ propertyId: 1, occurredAt: -1 });

module.exports = model('GateAccessEvent', gateAccessEventSchema);

