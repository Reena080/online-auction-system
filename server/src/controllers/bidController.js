const bidService = require('../services/bidService');
const { successResponse } = require('../utils/response');

class BidController {
  async placeBid(req, res, next) {
    try {
      const { auctionId } = req.params;
      const { amount } = req.body;
      const user = req.user;

      const result = await bidService.placeBid({
        auctionId,
        user,
        amount
      });

      return successResponse(res, 201, 'Bid accepted.', result);
    } catch (error) {
      next(error);
    }
  }

  async getBids(req, res, next) {
    try {
      const { auctionId } = req.params;
      const page = req.query.page || 1;
      const limit = req.query.limit || 20;

      const result = await bidService.getBidHistory(auctionId, page, limit);

      // Per specification:
      // { "success": true, "data": [], "pagination": { page, limit, total, totalPages } }
      return res.status(200).json({
        success: true,
        data: result.bids,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BidController();
