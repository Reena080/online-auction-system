const { v4: uuidv4 } = require('uuid');
const { getClient } = require('../config/postgres');
const auctionRepository = require('../repositories/auctionRepository');
const bidRepository = require('../repositories/bidRepository');
const auctionService = require('./auctionService');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errorMiddleware');

// Row-level lock coordinator ensuring serialized execution per auction record
class AuctionLockManager {
  constructor() {
    this.activeLocks = new Map();
  }

  async acquire(auctionId) {
    while (this.activeLocks.has(auctionId)) {
      await this.activeLocks.get(auctionId);
    }
    let release;
    const lockPromise = new Promise((resolve) => {
      release = resolve;
    });
    this.activeLocks.set(auctionId, lockPromise);
    return () => {
      this.activeLocks.delete(auctionId);
      release();
    };
  }
}

const lockManager = new AuctionLockManager();

class BidService {
  /**
   * Place a bid within a strict PostgreSQL row-level locked transaction (SELECT ... FOR UPDATE).
   * @param {Object} params
   * @param {string} [params.auctionId] - UUID of auction (optional in single-item mode)
   * @param {Object} params.user - Authenticated user { id, name, email }
   * @param {number} params.amount - Submitted bid amount
   */
  async placeBid({ auctionId, user, amount }) {
    const bidAmount = parseFloat(amount);
    if (isNaN(bidAmount) || bidAmount <= 0) {
      throw new AppError('Bid amount must be a positive number.', 400, 'VALIDATION_ERROR');
    }

    // Resolve target auction ID if omitted (Single Item Mode)
    let targetAuctionId = auctionId;
    if (!targetAuctionId) {
      const currentAuction = await auctionRepository.getCurrentAuction();
      if (!currentAuction) {
        throw new AppError('No active auction found.', 404, 'AUCTION_NOT_FOUND');
      }
      targetAuctionId = currentAuction.id;
    }

    const releaseLock = await lockManager.acquire(targetAuctionId);
    const client = await getClient();

    try {
      // 1. Begin Explicit PostgreSQL Transaction
      await client.query('BEGIN');

      // 2. Obtain Row-Level Exclusive Lock on Target Auction
      // SQL: SELECT * FROM auctions WHERE id = $1 FOR UPDATE;
      const auction = await auctionRepository.findByIdForUpdate(client, targetAuctionId);

      // Check 1: Auction Existence
      if (!auction) {
        throw new AppError('Auction not found.', 404, 'AUCTION_NOT_FOUND');
      }

      // Check 2: Auction Expiry Check (Authoritative DB Time vs End Time)
      const currentDbTime = new Date(auction.currentDbTime || Date.now());
      const endTime = new Date(auction.endTime);

      if (auction.status !== 'ACTIVE' || currentDbTime >= endTime) {
        if (auction.status === 'ACTIVE') {
          await client.query("UPDATE auctions SET status = 'ENDED' WHERE id = $1", [targetAuctionId]);
        }
        // HTTP 400 per challenge specification: "Auction has ended"
        throw new AppError('Auction has ended', 400, 'AUCTION_ENDED');
      }

      // Check 3: Strict Amount Comparison (> current_highest_bid and >= starting_price)
      const currentHighest = parseFloat(auction.currentHighestBid !== null && auction.currentHighestBid !== undefined 
        ? auction.currentHighestBid 
        : auction.startingPrice || 0);
      const startingPrice = parseFloat(auction.startingPrice || 0);

      if (bidAmount <= currentHighest || bidAmount < startingPrice) {
        // HTTP 409 Conflict per challenge specification
        throw new AppError(
          'Bid must be strictly higher than current highest bid',
          409,
          'BID_TOO_LOW',
          {
            currentHighestBid: currentHighest,
            startingPrice: startingPrice,
            submittedBid: bidAmount
          }
        );
      }

      // 4. Insert New Bid Record
      const bidId = uuidv4();
      const newBid = await bidRepository.create(client, {
        id: bidId,
        auctionId: targetAuctionId,
        bidderId: user.id,
        amount: bidAmount
      });

      // 5. Update Auction Highest Bid and Bidder ID
      const updatedAuction = await auctionRepository.updateHighestBid(
        client,
        targetAuctionId,
        bidAmount,
        user.id
      );

      // 6. Commit Explicit PostgreSQL Transaction
      await client.query('COMMIT');

      // Post-Commit 1: Invalidate & Refresh Redis Cache for the item's highest bid
      auctionService.invalidateCache(targetAuctionId).catch((err) => {
        console.warn(`[CACHE_INVALIDATION_WARNING] ${err.message}`);
      });

      // Post-Commit 2: Asynchronously write audit event log to MongoDB (user_id, bid_amount, timestamp, status)
      auditService.logEvent({
        event: 'BID_ACCEPTED',
        auctionId: targetAuctionId,
        user_id: user.id,
        userId: user.id,
        bid_amount: bidAmount,
        amount: bidAmount,
        timestamp: new Date().toISOString(),
        status: 'ACCEPTED',
        metadata: {
          bidId,
          bidderName: user.name,
          previousHighestBid: currentHighest
        }
      });
      auditService.logEvent({
        event: 'BID_PLACED',
        auctionId: targetAuctionId,
        user_id: user.id,
        userId: user.id,
        bid_amount: bidAmount,
        amount: bidAmount,
        timestamp: new Date().toISOString(),
        status: 'ACCEPTED',
        metadata: {
          bidId,
          bidderName: user.name,
          previousHighestBid: currentHighest
        }
      });

      return {
        bid: {
          id: newBid.id,
          auctionId: newBid.auctionId,
          bidderId: newBid.bidderId,
          bidderName: user.name,
          amount: parseFloat(newBid.amount),
          createdAt: newBid.createdAt
        },
        auction: {
          id: updatedAuction.id,
          currentHighestBid: parseFloat(updatedAuction.currentHighestBid),
          highestBidderId: updatedAuction.highestBidderId,
          highestBidderName: user.name,
          status: updatedAuction.status,
          endTime: updatedAuction.endTime
        }
      };
    } catch (error) {
      // Rollback transaction on any failure
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[TRANSACTION_ROLLBACK_ERROR]', rollbackErr.message);
      }

      // Asynchronously log Rejection Audit Event to MongoDB
      auditService.logEvent({
        event: 'BID_REJECTED',
        auctionId: targetAuctionId,
        user_id: user ? user.id : 'unknown',
        userId: user ? user.id : 'unknown',
        bid_amount: bidAmount,
        amount: bidAmount,
        timestamp: new Date().toISOString(),
        status: 'REJECTED',
        metadata: {
          error: error.errorCode || 'TRANSACTION_ERROR',
          message: error.message
        }
      });

      throw error;
    } finally {
      // Ensure client is always released back to pool and row lock is released
      if (client.release) {
        client.release();
      }
      releaseLock();
    }
  }

  async getBidHistory(auctionId = null, page = 1, limit = 20) {
    let targetAuctionId = auctionId;
    if (!targetAuctionId) {
      const currentAuction = await auctionRepository.getCurrentAuction();
      if (!currentAuction) {
        return { bids: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
      }
      targetAuctionId = currentAuction.id;
    }

    const result = await bidRepository.getBidsByAuction(targetAuctionId, page, limit);
    return {
      bids: result.bids.map(b => ({
        id: b.id,
        auctionId: b.auctionId,
        bidderId: b.bidderId,
        bidderName: b.bidderName,
        amount: parseFloat(b.amount),
        createdAt: b.createdAt
      })),
      pagination: result.pagination
    };
  }
}

module.exports = new BidService();

