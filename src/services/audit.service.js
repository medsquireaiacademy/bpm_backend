const crypto = require('crypto');
const AuditEvent = require('../models/AuditEvent.model');

class AuditService {
  /**
   * Log an audit event
   */
  static async log({
    aggregateType,
    aggregateId,
    propertyId = 'GLOBAL',
    actorType = 'USER',
    actorId,
    action,
    fromStatus = null,
    toStatus = null,
    reason = null,
    requestId = null,
    metadata = null
  }) {
    try {
      const eventId = `aud_${crypto.randomUUID()}`;
      return await AuditEvent.create({
        eventId,
        aggregateType,
        aggregateId,
        propertyId,
        actorType,
        actorId: actorId || 'SYSTEM',
        action,
        fromStatus,
        toStatus,
        reason,
        requestId,
        metadata
      });
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err.message);
      return null;
    }
  }
}

module.exports = AuditService;

