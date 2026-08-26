const request = require('supertest');
const app = require('../server/src/app');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');

describe('Bid Placement and Validation Tests', () => {
  let seedData;
  let aliceToken;
  let bobToken;

  beforeAll(async () => {
    const env = await setupTestEnvironment({
      startingPrice: 500,
      currentHighestBid: 500,
      durationMinutes: 60
    });
    seedData = env.seedData;

    // Login Alice
    const resA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@bellcorp.com', password: 'Password123!' });
    aliceToken = resA.body.data.token;

    // Login Bob
    const resB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@bellcorp.com', password: 'Password123!' });
    bobToken = resB.body.data.token;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('POST /api/auction/:auctionId/bids', () => {
    it('should successfully accept a valid higher bid (HTTP 201)', async () => {
      const res = await request(app)
        .post(`/api/auction/${seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ amount: 600 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Bid accepted.');
      expect(res.body.data.bid.amount).toBe(600);
      expect(res.body.data.auction.currentHighestBid).toBe(600);
      expect(res.body.data.bid.bidderName).toBe('Alice Walker');
    });

    it('should reject a lower bid than the current highest bid (HTTP 409 BID_TOO_LOW)', async () => {
      // Current highest is now 600, Bob tries to bid 550
      const res = await request(app)
        .post(`/api/auction/${seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ amount: 550 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BID_TOO_LOW');
      expect(res.body.message).toContain('Bid must be higher than the current highest bid');
    });

    it('should reject an equal bid to the current highest bid (HTTP 409 BID_TOO_LOW)', async () => {
      // Current highest is 600, Bob tries to bid 600
      const res = await request(app)
        .post(`/api/auction/${seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ amount: 600 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('BID_TOO_LOW');
    });

    it('should reject unauthenticated bid attempt (HTTP 401 UNAUTHORIZED)', async () => {
      const res = await request(app)
        .post(`/api/auction/${seedData.auctionId}/bids`)
        .send({ amount: 700 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('UNAUTHORIZED');
    });

    it('should reject non-numeric or malformed bid amounts (HTTP 400)', async () => {
      const res = await request(app)
        .post(`/api/auction/${seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ amount: -100 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('VALIDATION_ERROR');
    });
  });

  describe('Auction Expiry Handling', () => {
    it('should reject bids on an expired auction (HTTP 409 AUCTION_ENDED)', async () => {
      // Setup a new expired auction test environment (end_time in the past)
      const pastStartTime = new Date(Date.now() - 120 * 60 * 1000);
      const pastEndTime = new Date(Date.now() - 60 * 60 * 1000);

      const expiredEnv = await setupTestEnvironment({
        startTime: pastStartTime,
        endTime: pastEndTime,
        status: 'ACTIVE' // Active flag but time past
      });

      const res = await request(app)
        .post(`/api/auction/${expiredEnv.seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ amount: 800 });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('AUCTION_ENDED');
      expect(res.body.message).toBe('The auction has already ended.');
    });
  });

  describe('GET /api/auction/:auctionId/bids (Bid History Pagination)', () => {
    it('should return paginated bid history correctly', async () => {
      const env = await setupTestEnvironment({
        startingPrice: 500,
        currentHighestBid: 500,
        durationMinutes: 60
      });

      // Place 3 valid ascending bids
      await request(app)
        .post(`/api/auction/${env.seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ amount: 550 });

      await request(app)
        .post(`/api/auction/${env.seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ amount: 600 });

      await request(app)
        .post(`/api/auction/${env.seedData.auctionId}/bids`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ amount: 650 });

      // Fetch bid history with pagination
      const res = await request(app)
        .get(`/api/auction/${env.seedData.auctionId}/bids?page=1&limit=2`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].amount).toBe(650); // Most recent bid first
      expect(res.body.pagination).toEqual({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2
      });
    });
  });
});
