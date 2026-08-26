const { getAuditCollection } = require('../config/mongo');

class AuditService {
  /**
   * Log an audit event to MongoDB without blocking or crashing the primary application flow.
   * @param {Object} eventData
   * @param {'USER_REGISTERED'|'USER_LOGIN'|'BID_PLACED'|'BID_REJECTED'|'AUCTION_ENDED'} eventData.event
   * @param {string} [eventData.auctionId]
   * @param {string} [eventData.userId]
   * @param {number} [eventData.amount]
   * @param {string} [eventData.timestamp]
   * @param {Object} [eventData.metadata]
   */
  async logEvent(eventData) {
    try {
      const collection = getAuditCollection();
      if (!collection) return;

      const logDocument = {
        event: eventData.event,
        auctionId: eventData.auctionId || null,
        userId: eventData.userId || null,
        amount: eventData.amount !== undefined ? eventData.amount : null,
        timestamp: eventData.timestamp || new Date().toISOString(),
        metadata: eventData.metadata || {}
      };

      // Fire-and-forget or non-blocking await
      await collection.insertOne(logDocument);
    } catch (error) {
      // Per requirements: MongoDB failure must NEVER rollback a successful bid or crash the API
      console.warn(`[AUDIT_LOG_ERROR] Failed to write audit event ${eventData.event}: ${error.message}`);
    }
  }

  async getLogs(query = {}) {
    try {
      const collection = getAuditCollection();
      if (!collection) return [];
      const cursor = await collection.find(query);
      return await cursor.toArray();
    } catch (error) {
      console.warn(`[AUDIT_LOG_ERROR] Failed to fetch audit logs: ${error.message}`);
      return [];
    }
  }
}

module.exports = new AuditService();
