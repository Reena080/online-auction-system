const request = require('supertest');
const app = require('../server/src/app');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');

describe('Auction API Tests', () => {
  let seedData;

  beforeAll(async () => {
    const env = await setupTestEnvironment({ durationMinutes: 30 });
    seedData = env.seedData;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('GET /api/auction & /api/auctions', () => {
    it('should retrieve the current active auction via /api/auction', async () => {
      const res = await request(app).get('/api/auction');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(seedData.auctionId);
      expect(res.body.data.title).toContain('Vintage');
      expect(res.body.data.currentHighestBid).toBe(500);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should retrieve the current active auction via plural /api/auctions', async () => {
      const res = await request(app).get(`/api/auctions/${seedData.auctionId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(seedData.auctionId);
    });

    it('should return 404 for non-existent auction ID', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';
      const res = await request(app).get(`/api/auction/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('AUCTION_NOT_FOUND');
    });
  });

  describe('GET /api/auction/status & /api/auctions/:auctionId/result', () => {
    it('should retrieve current auction status and remaining time', async () => {
      const res = await request(app).get('/api/auction/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.timeRemainingSeconds).toBeGreaterThan(0);
      expect(res.body.data.currentHighestBid).toBe(500);
    });

    it('should retrieve auction result via /api/auctions/:auctionId/result', async () => {
      const res = await request(app).get(`/api/auctions/${seedData.auctionId}/result`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(seedData.auctionId);
      expect(['ACTIVE', 'ENDED']).toContain(res.body.data.status);
    });
  });
});
