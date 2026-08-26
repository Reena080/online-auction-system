const express = require('express');
const auctionController = require('../controllers/auctionController');
const bidController = require('../controllers/bidController');
const { authenticate } = require('../middleware/authMiddleware');
const { bidRateLimiter } = require('../middleware/rateLimitMiddleware');
const { validateBody, validateQuery } = require('../middleware/validateMiddleware');
const { bidSchema, paginationQuerySchema } = require('../utils/validators');

const router = express.Router();

// List all auctions (GET /api/auctions) or single current auction (GET /api/auction)
router.get('/', (req, res, next) => {
  if (req.baseUrl === '/api/auction' && !req.query.all && !req.query.status && !req.query.search) {
    return auctionController.getAuction(req, res, next);
  }
  auctionController.getAuctions(req, res, next);
});

// Reset demo auctions to fresh 3-5m active status
router.post('/reset', (req, res, next) => {
  auctionController.resetAuctions(req, res, next);
});
router.get('/reset', (req, res, next) => {
  auctionController.resetAuctions(req, res, next);
});

// Single active status helper
router.get('/status', (req, res, next) => {
  auctionController.getAuctionStatus(req, res, next);
});

// Single Item Bid endpoint (POST /api/auction/bid & POST /api/auction/bids)
const placeBidHandlers = [
  authenticate,
  bidRateLimiter(),
  validateBody(bidSchema),
  (req, res, next) => {
    bidController.placeBid(req, res, next);
  }
];

router.post('/bid', ...placeBidHandlers);
router.post('/bids', ...placeBidHandlers);

// Single Item Bid History (GET /api/auction/bids)
router.get(
  '/bids',
  validateQuery(paginationQuerySchema),
  (req, res, next) => {
    bidController.getBids(req, res, next);
  }
);

// Single Item Result endpoint (GET /api/auction/result)
router.get('/result', (req, res, next) => {
  auctionController.getAuctionResult(req, res, next);
});

// Specific auction details (GET /api/auctions/:auctionId)
router.get('/:auctionId', (req, res, next) => {
  auctionController.getAuction(req, res, next);
});

router.get('/:auctionId/status', (req, res, next) => {
  auctionController.getAuctionStatus(req, res, next);
});

// Auction result & winner endpoint (GET /api/auctions/:auctionId/result)
router.get('/:auctionId/result', (req, res, next) => {
  auctionController.getAuctionResult(req, res, next);
});

// Bids on specific auction (Supports both /:auctionId/bid and /:auctionId/bids)
router.post('/:auctionId/bids', ...placeBidHandlers);
router.post('/:auctionId/bid', ...placeBidHandlers);

// Bid History for specific auction (GET /api/auctions/:auctionId/bids)
router.get(
  '/:auctionId/bids',
  validateQuery(paginationQuerySchema),
  (req, res, next) => {
    bidController.getBids(req, res, next);
  }
);

module.exports = router;

