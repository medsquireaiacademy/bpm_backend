const { Schema, model } = require('mongoose');

const auditEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    aggregateType: { type: String, required: true, index: true },
    aggregateId: { type: String, required: true, index: true },
    propertyId: { type: String, index: true },
    actorType: { type: String, default: 'USER' },
    actorId: { type: String, required: true },
    action: { type: String, required: true },
    fromStatus: { type: String },
    toStatus: { type: String },
    reason: { type: String },
    requestId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    occurredAt: { type: Date, default: Date.now, index: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

auditEventSchema.index({ aggregateType: 1, aggregateId: 1, occurredAt: -1 });

module.exports = model('AuditEvent', auditEventSchema);

