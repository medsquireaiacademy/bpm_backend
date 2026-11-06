const crypto = require('crypto');
const OutboxEvent = require('../models/OutboxEvent.model');
const {
  WEBHOOK_SIGNING_SECRET,
  RESIDENCE_WEBHOOK_URL,
  RWA_WEBHOOK_URL,
  AGENCY_WEBHOOK_URL,
  TECHNICIAN_WEBHOOK_URL,
  SECURITY_WEBHOOK_URL
} = require('../config/env');

const DESTINATION_URLS = {
  RESIDENCE: RESIDENCE_WEBHOOK_URL,
  RWA: RWA_WEBHOOK_URL,
  AGENCY: AGENCY_WEBHOOK_URL,
  TECHNICIAN: TECHNICIAN_WEBHOOK_URL,
  SECURITY: SECURITY_WEBHOOK_URL
};

class OutboxPublisherWorker {
  /**
   * Generate HMAC-SHA-256 signature for webhook payload
   */
  static generateSignature(timestamp, payload) {
    const raw = `${timestamp}.${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
    return crypto.createHmac('sha256', WEBHOOK_SIGNING_SECRET).update(raw).digest('hex');
  }

  /**
   * Dispatch an HTTP webhook with signature headers
   */
  static async dispatchWebhook(url, event) {
    const timestamp = Date.now().toString();
    const payloadString = JSON.stringify({
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      data: event.payload,
      timestamp: new Date().toISOString()
    });

    const signature = this.generateSignature(timestamp, payloadString);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bee-Event-Id': event.eventId,
          'X-Bee-Timestamp': timestamp,
          'X-Bee-Signature': signature
        },
        body: payloadString,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Webhook endpoint returned HTTP ${response.status}`);
      }
      return true;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Process a single event
   */
  static async processEvent(event, maxAttempts = 5) {
    const targets = [];
    if (event.destination === 'ALL') {
      Object.entries(DESTINATION_URLS).forEach(([dest, url]) => {
        if (url) targets.push({ dest, url });
      });
    } else {
      const url = DESTINATION_URLS[event.destination];
      if (url) targets.push({ dest: event.destination, url });
    }

    try {
      if (targets.length > 0) {
        // Dispatch to all configured target webhooks
        await Promise.all(targets.map((t) => this.dispatchWebhook(t.url, event)));
      }

      event.status = 'DELIVERED';
      event.deliveredAt = new Date();
      event.attemptCount += 1;
      await event.save();
      return true;
    } catch (err) {
      event.attemptCount += 1;
      event.lastErrorCode = err.message || 'DISPATCH_ERROR';

      if (event.attemptCount >= maxAttempts) {
        event.status = 'DEAD_LETTER';
      } else {
        event.status = 'PENDING';
        // Exponential backoff: base 2s * 2^(attempts-1) + jitter
        const backoffMs = Math.min(60000, 2000 * Math.pow(2, event.attemptCount - 1) + Math.random() * 1000);
        event.nextAttemptAt = new Date(Date.now() + backoffMs);
      }
      await event.save();
      return false;
    }
  }

  /**
   * Poll and deliver pending outbox events
   */
  static async processBatch(batchSize = 25) {
    const now = new Date();

    // Atomically find due events
    const dueEvents = await OutboxEvent.find({
      status: 'PENDING',
      nextAttemptAt: { $lte: now }
    })
      .sort({ createdAt: 1 })
      .limit(batchSize);

    let deliveredCount = 0;
    for (const event of dueEvents) {
      const success = await this.processEvent(event);
      if (success) deliveredCount++;
    }

    return { total: dueEvents.length, delivered: deliveredCount };
  }
}

module.exports = OutboxPublisherWorker;

