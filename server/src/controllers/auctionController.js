const auctionService = require('../services/auctionService');
const { successResponse } = require('../utils/response');

class AuctionController {
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
      return successResponse(res, 200, 'Auction result retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuctionController();
