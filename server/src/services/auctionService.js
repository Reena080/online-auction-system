const auctionRepository = require('../repositories/auctionRepository');
const { getRedisClient } = require('../config/redis');
const auditService = require('./auditService');
const { AppError } = require('../middleware/errorMiddleware');

const CACHE_TTL_SECONDS = 8; // 5-10s per assignment requirement

class AuctionService {
  getCacheKey(auctionId) {
    return `auction:${auctionId}`;
  }

  async invalidateCache(auctionId) {
    try {
      const redis = getRedisClient();
      if (redis) {
        await redis.del(this.getCacheKey(auctionId));
        await redis.del('auction:current');
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[REDIS_CACHE] Failed to invalidate cache for ${auctionId}: ${err.message}`);
      }
    }
  }

  async getAuction(auctionId = null) {
    const redis = getRedisClient();
    const cacheKey = auctionId ? this.getCacheKey(auctionId) : 'auction:current';

    // 1. Try Redis Cache
    try {
      if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Check if ended according to time
          if (parsed.status === 'ACTIVE' && new Date(parsed.endTime) <= new Date()) {
            parsed.status = 'ENDED';
          }
          return {
            ...parsed,
            _cached: true
          };
        }
      }
    } catch (cacheErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[REDIS_CACHE] Read error: ${cacheErr.message}. Falling back to PostgreSQL.`);
      }
    }

    // 2. Query PostgreSQL (Source of Truth)
    let auction;
    if (auctionId) {
      auction = await auctionRepository.findById(auctionId);
    } else {
      auction = await auctionRepository.getCurrentAuction();
    }

    if (!auction) {
      throw new AppError('Auction not found.', 404, 'AUCTION_NOT_FOUND');
    }

    // Format numbers
    auction.startingPrice = parseFloat(auction.startingPrice);
    auction.currentHighestBid = parseFloat(auction.currentHighestBid);

    // 3. Time-based status check
    const currentDbTime = new Date(auction.currentDbTime || Date.now());
    const endTime = new Date(auction.endTime);

    if (auction.status === 'ACTIVE' && currentDbTime >= endTime) {
      auction.status = 'ENDED';
      await auctionRepository.updateStatus(auction.id, 'ENDED');
      
      // MongoDB audit event
      auditService.logEvent({
        event: 'AUCTION_ENDED',
        auctionId: auction.id,
        timestamp: new Date().toISOString(),
        metadata: {
          winningBid: auction.currentHighestBid,
          winnerId: auction.highestBidderId
        }
      });
    }

    // 4. Populate Redis Cache
    try {
      if (redis) {
        const cachePayload = JSON.stringify({
          id: auction.id,
          title: auction.title,
          description: auction.description,
          startingPrice: auction.startingPrice,
          currentHighestBid: auction.currentHighestBid,
          highestBidderId: auction.highestBidderId,
          highestBidderName: auction.highestBidderName,
          startTime: auction.startTime,
          endTime: auction.endTime,
          status: auction.status,
          createdAt: auction.createdAt
        });

        await redis.set(cacheKey, cachePayload, 'EX', CACHE_TTL_SECONDS);
        if (auctionId) {
          await redis.set('auction:current', cachePayload, 'EX', CACHE_TTL_SECONDS);
        }
      }
    } catch (cacheErr) {
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[REDIS_CACHE] Write error: ${cacheErr.message}`);
      }
    }

    return auction;
  }

  async getAuctionStatus(auctionId = null) {
    const auction = await this.getAuction(auctionId);
    const now = new Date();
    const endTime = new Date(auction.endTime);
    const isEnded = auction.status === 'ENDED' || now >= endTime;

    return {
      id: auction.id,
      status: isEnded ? 'ENDED' : 'ACTIVE',
      currentHighestBid: auction.currentHighestBid,
      highestBidderId: auction.highestBidderId,
      highestBidderName: auction.highestBidderName,
      endTime: auction.endTime,
      timeRemainingSeconds: Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000))
    };
  }
}

module.exports = new AuctionService();
