const { Schema, model } = require('mongoose');

const outboxEventSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    eventType: { type: String, required: true, index: true },
    eventVersion: { type: Number, default: 1 },
    aggregateType: { type: String, required: true },
    aggregateId: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    destination: { type: String, default: 'ALL', index: true },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'DELIVERED', 'FAILED', 'DEAD_LETTER'],
      default: 'PENDING',
      index: true
    },
    attemptCount: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    lastErrorCode: { type: String },
    deliveredAt: { type: Date }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });

module.exports = model('OutboxEvent', outboxEventSchema);

