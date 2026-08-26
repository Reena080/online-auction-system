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
   * @param {string} params.auctionId - UUID of auction
   * @param {Object} params.user - Authenticated user { id, name, email }
   * @param {number} params.amount - Submitted bid amount
   */
  async placeBid({ auctionId, user, amount }) {
    const releaseLock = await lockManager.acquire(auctionId);
    const client = await getClient();
    const bidAmount = parseFloat(amount);

    try {
      // 1. Begin PostgreSQL Transaction
      await client.query('BEGIN');

      // 2. Obtain Row-Level Exclusive Lock on Auction
      const auction = await auctionRepository.findByIdForUpdate(client, auctionId);

      // Check 1: Auction Existence
      if (!auction) {
        throw new AppError('Auction not found.', 404, 'AUCTION_NOT_FOUND');
      }

      // Check 2: Auction Status
      if (auction.status !== 'ACTIVE') {
        throw new AppError('The auction has already ended.', 409, 'AUCTION_ENDED');
      }

      // Check 3: Auction Expiry Check against Authoritative Database Time
      const currentDbTime = new Date(auction.currentDbTime || Date.now());
      const endTime = new Date(auction.endTime);

      if (currentDbTime >= endTime) {
        // Auction time expired: update status inside transaction
        await client.query("UPDATE auctions SET status = 'ENDED' WHERE id = $1", [auctionId]);
        throw new AppError('The auction has already ended.', 409, 'AUCTION_ENDED');
      }

      // Check 4: Strict Amount Comparison (> current_highest_bid)
      const currentHighest = parseFloat(auction.currentHighestBid);
      if (bidAmount <= currentHighest) {
        throw new AppError(
          `Bid must be higher than the current highest bid of ₹${currentHighest.toFixed(2)}.`,
          409,
          'BID_TOO_LOW',
          {
            currentHighestBid: currentHighest,
            submittedBid: bidAmount
          }
        );
      }

      // 5. Insert New Bid Record
      const bidId = uuidv4();
      const newBid = await bidRepository.create(client, {
        id: bidId,
        auctionId,
        bidderId: user.id,
        amount: bidAmount
      });

      // 6. Update Auction Highest Bid and Bidder ID
      const updatedAuction = await auctionRepository.updateHighestBid(
        client,
        auctionId,
        bidAmount,
        user.id
      );

      // 7. Commit Transaction (Locks released upon COMMIT)
      await client.query('COMMIT');

      // Post-Commit 1: Invalidate Redis Cache
      auctionService.invalidateCache(auctionId).catch((err) => {
        console.warn(`[CACHE_INVALIDATION_WARNING] ${err.message}`);
      });

      // Post-Commit 2: Log Audit Event to MongoDB (Non-blocking)
      auditService.logEvent({
        event: 'BID_ACCEPTED',
        auctionId,
        userId: user.id,
        amount: bidAmount,
        timestamp: new Date().toISOString(),
        metadata: {
          bidId,
          bidderName: user.name,
          previousHighestBid: currentHighest
        }
      });
      auditService.logEvent({
        event: 'BID_PLACED',
        auctionId,
        userId: user.id,
        amount: bidAmount,
        timestamp: new Date().toISOString(),
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
      // Rollback on any failure
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[TRANSACTION_ROLLBACK_ERROR]', rollbackErr.message);
      }

      // Log Rejection Audit Event to MongoDB
      auditService.logEvent({
        event: 'BID_REJECTED',
        auctionId,
        userId: user ? user.id : 'unknown',
        amount: bidAmount,
        timestamp: new Date().toISOString(),
        metadata: {
          error: error.errorCode || 'TRANSACTION_ERROR',
          message: error.message
        }
      });

      throw error;
    } finally {
      // Ensure client is always released back to pool and row lock released
      if (client.release) {
        client.release();
      }
      releaseLock();
    }
  }

  async getBidHistory(auctionId, page = 1, limit = 20) {
    const result = await bidRepository.getBidsByAuction(auctionId, page, limit);
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
