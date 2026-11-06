const { Schema, model } = require('mongoose');

const idempotencyRecordSchema = new Schema(
  {
    clientId: { type: String, required: true },
    idempotencyKey: { type: String, required: true },
    requestHash: { type: String, required: true },
    resourceType: { type: String },
    resourceId: { type: String },
    responseStatus: { type: Number },
    responseBody: { type: Schema.Types.Mixed },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

idempotencyRecordSchema.index({ clientId: 1, idempotencyKey: 1 }, { unique: true });

module.exports = model('IdempotencyRecord', idempotencyRecordSchema);

