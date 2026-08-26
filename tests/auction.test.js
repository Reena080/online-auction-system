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

  describe('GET /api/auction', () => {
    it('should retrieve the current active auction', async () => {
      const res = await request(app).get('/api/auction');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(seedData.auctionId);
      expect(res.body.data.title).toContain('Vintage');
      expect(res.body.data.currentHighestBid).toBe(500);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('should retrieve a specific auction by ID', async () => {
      const res = await request(app).get(`/api/auction/${seedData.auctionId}`);

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

  describe('GET /api/auction/status', () => {
    it('should retrieve current auction status and remaining time', async () => {
      const res = await request(app).get('/api/auction/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.timeRemainingSeconds).toBeGreaterThan(0);
      expect(res.body.data.currentHighestBid).toBe(500);
    });
  });
});
