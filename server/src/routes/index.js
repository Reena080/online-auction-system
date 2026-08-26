const express = require('express');
const authRoutes = require('./authRoutes');
const auctionRoutes = require('./auctionRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/auction', auctionRoutes);
router.use('/auctions', auctionRoutes);

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'HEALTHY',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
