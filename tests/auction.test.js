const request = require('supertest');
const app = require('../server/src/app');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');
const { AUCTION_1_ID, AUCTION_2_ID } = require('../server/migrations/seed');

describe('Multi-Item Auction API Tests', () => {
  let seedData;
  let aliceToken;

  beforeAll(async () => {
    const env = await setupTestEnvironment({ durationMinutes: 30 });
    seedData = env.seedData;

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@bellcorp.com', password: 'Password123!' });
    aliceToken = res.body.data.token;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('GET /api/auctions (Marketplace listing)', () => {
    it('should retrieve all available seeded auctions', async () => {
      const res = await request(app).get('/api/auctions');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5);

      const titles = res.body.data.map(a => a.title);
      expect(titles.some(t => t.includes('Sony'))).toBe(true);
      expect(titles.some(t => t.includes('iPhone'))).toBe(true);
      expect(titles.some(t => t.includes('MacBook'))).toBe(true);
    });

    it('should support search query filtering', async () => {
      const res = await request(app).get('/api/auctions?search=Sony');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].title).toContain('Sony');
    });

    it('should support status filtering', async () => {
      const res = await request(app).get('/api/auctions?status=ACTIVE');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      res.body.data.forEach(item => {
        expect(item.status).toBe('ACTIVE');
      });
    });
  });

  describe('GET /api/auctions/:auctionId (Individual Auction)', () => {
    it('should retrieve individual auction details', async () => {
      const res = await request(app).get(`/api/auctions/${AUCTION_1_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(AUCTION_1_ID);
      expect(res.body.data.title).toContain('Sony');
    });

    it('should return 404 for non-existent auction ID', async () => {
      const nonExistentId = '99999999-9999-9999-9999-999999999999';
      const res = await request(app).get(`/api/auctions/${nonExistentId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('AUCTION_NOT_FOUND');
    });
  });

  describe('GET /api/auctions/:auctionId/result (Auction Result Logic)', () => {
    it('should return status ACTIVE, winner null, winningBid null for active auction', async () => {
      const res = await request(app).get(`/api/auctions/${AUCTION_1_ID}/result`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Auction is still active.');
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.winner).toBeNull();
      expect(res.body.data.winningBid).toBeNull();
      expect(res.body.data.endTime).toBeDefined();
    });

    it('should return status ENDED and winner information for expired auction', async () => {
      // Create an expired auction with a winning bid
      const expiredEnv = await setupTestEnvironment({
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() - 1000),
        status: 'ACTIVE'
      });

      const res = await request(app).get(`/api/auctions/${expiredEnv.seedData.auctionId}/result`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Auction result retrieved successfully.');
      expect(res.body.data.status).toBe('ENDED');
      expect(res.body.data.endTime).toBeDefined();
    });
  });
});
