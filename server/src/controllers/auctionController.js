const auctionService = require('../services/auctionService');
const { successResponse } = require('../utils/response');

class AuctionController {
  async getAuctions(req, res, next) {
    try {
      const { status, search } = req.query;
      const auctions = await auctionService.getAuctions({ status, search });
      return successResponse(res, 200, 'Auctions retrieved successfully.', auctions);
    } catch (error) {
      next(error);
    }
  }

  async getAuction(req, res, next) {
    try {
      const auctionId = req.params.auctionId || null;
      const auction = await auctionService.getAuction(auctionId);
      return successResponse(res, 200, 'Auction retrieved successfully.', auction);
    } catch (error) {
      next(error);
    }
  }

  async getAuctionStatus(req, res, next) {
    try {
      const auctionId = req.params.auctionId || null;
      const status = await auctionService.getAuctionStatus(auctionId);
      return successResponse(res, 200, 'Auction status retrieved successfully.', status);
    } catch (error) {
      next(error);
    }
  }

  async getAuctionResult(req, res, next) {
    try {
      const auctionId = req.params.auctionId || null;
      const result = await auctionService.getAuctionResult(auctionId);
      const message = result.status === 'ACTIVE'
        ? 'Auction is still active.'
        : 'Auction result retrieved successfully.';

      // Strip internal flags if any
      const { isStillActive, ...data } = result;

      return successResponse(res, 200, message, data);
    } catch (error) {
      next(error);
    }
  }

  async resetAuctions(req, res, next) {
    try {
      const { seed } = require('../../migrations/seed');
      const { getPool } = require('../config/postgres');
      const pool = getPool();
      await seed(pool, { startTime: new Date() });
      const auctions = await auctionService.getAuctions();
      return successResponse(res, 200, 'Auctions reset successfully with fresh 3-5 minute durations.', auctions);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuctionController();
