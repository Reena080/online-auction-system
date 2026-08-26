const express = require('express');
const auctionController = require('../controllers/auctionController');
const bidController = require('../controllers/bidController');
const { authenticate } = require('../middleware/authMiddleware');
const { bidRateLimiter } = require('../middleware/rateLimitMiddleware');
const { validateBody, validateQuery } = require('../middleware/validateMiddleware');
const { bidSchema, paginationQuerySchema } = require('../utils/validators');

const router = express.Router();

// Auction details
router.get('/', (req, res, next) => {
  auctionController.getAuction(req, res, next);
});

router.get('/status', (req, res, next) => {
  auctionController.getAuctionStatus(req, res, next);
});

router.get('/:auctionId', (req, res, next) => {
  auctionController.getAuction(req, res, next);
});

router.get('/:auctionId/status', (req, res, next) => {
  auctionController.getAuctionStatus(req, res, next);
});

// Bids on auction
router.post(
  '/:auctionId/bids',
  authenticate,
  bidRateLimiter(),
  validateBody(bidSchema),
  (req, res, next) => {
    bidController.placeBid(req, res, next);
  }
);

router.get(
  '/:auctionId/bids',
  validateQuery(paginationQuerySchema),
  (req, res, next) => {
    bidController.getBids(req, res, next);
  }
);

module.exports = router;
