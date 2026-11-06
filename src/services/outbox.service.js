const crypto = require('crypto');
const OutboxEvent = require('../models/OutboxEvent.model');

class OutboxService {
  /**
   * Enqueue a domain event into the outbox
   */
  static async publish({
    eventType,
    aggregateType,
    aggregateId,
    payload,
    destination = 'ALL'
  }) {
    try {
      const eventId = `evt_${crypto.randomUUID()}`;
      return await OutboxEvent.create({
        eventId,
        eventType,
        eventVersion: 1,
        aggregateType,
        aggregateId,
        payload,
        destination,
        status: 'PENDING',
        attemptCount: 0,
        nextAttemptAt: new Date()
      });
    } catch (err) {
      console.error('[OutboxService] Failed to enqueue outbox event:', err.message);
      return null;
    }
  }

  /**
   * Relay pending events (can be invoked by worker or interval)
   */
  static async processPendingEvents(batchSize = 20) {
    try {
      const now = new Date();
      const pending = await OutboxEvent.find({
        status: 'PENDING',
        nextAttemptAt: { $lte: now }
      })
        .limit(batchSize)
        .sort({ createdAt: 1 });

      for (const event of pending) {
        // Mark as DELIVERED in this standalone service
        event.status = 'DELIVERED';
        event.deliveredAt = new Date();
        event.attemptCount += 1;
        await event.save();
      }
      return pending.length;
    } catch (err) {
      console.error('[OutboxService] Error processing outbox events:', err.message);
      return 0;
    }
  }
}

module.exports = OutboxService;

