const request = require('supertest');
const app = require('../server/src/app');
const { getRedisClient } = require('../server/src/config/redis');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');

describe('Redis Cache & Rate Limiting Tests', () => {
  let seedData;
  let aliceToken;
  let mockRedis;

  beforeAll(async () => {
    const env = await setupTestEnvironment({
      startingPrice: 500,
      currentHighestBid: 500,
      durationMinutes: 60
    });
    seedData = env.seedData;
    mockRedis = env.mockRedis;

    // Login Alice
    const resA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@bellcorp.com', password: 'Password123!' });
    aliceToken = resA.body.data.token;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  describe('Auction Redis Cache & Invalidation', () => {
    it('should populate Redis cache on auction read', async () => {
      const auctionId = seedData.auctionId;
      const cacheKey = `auction:${auctionId}`;

      // Ensure cache is empty initially
      await mockRedis.del(cacheKey);

      // 1. Fetch auction
      const res = await request(app).get(`/api/auction/${auctionId}`);
      expect(res.status).toBe(200);

      // 2. Check that Redis now contains the cached data
      const cached = await mockRedis.get(cacheKey);
      expect(cached).not.toBeNull();
      const parsed = JSON.parse(cached);
      expect(parsed.id).toBe(auctionId);
      expect(parsed.currentHighestBid).toBe(500);

      // 3. Subsequent read should indicate cached
      const resCached = await request(app).get(`/api/auction/${auctionId}`);
      expect(resCached.status).toBe(200);
      expect(resCached.body.data._cached).toBe(true);
    });

    it('should invalidate Redis cache immediately after a successful bid', async () => {
      const auctionId = seedData.auctionId;
      const cacheKey = `auction:${auctionId}`;

      // 1. Ensure cache is populated
      await request(app).get(`/api/auction/${auctionId}`);
      const beforeBidCache = await mockRedis.get(cacheKey);
      expect(beforeBidCache).not.toBeNull();

      // 2. Place a valid higher bid
      const bidRes = await request(app)
        .post(`/api/auction/${auctionId}/bids`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ amount: 580 });
      expect(bidRes.status).toBe(201);

      // 3. Verify Redis cache was invalidated (key deleted)
      const afterBidCache = await mockRedis.get(cacheKey);
      expect(afterBidCache).toBeNull();

      // 4. Next read fetches fresh state from PostgreSQL and caches new value
      const freshRes = await request(app).get(`/api/auction/${auctionId}`);
      expect(freshRes.status).toBe(200);
      expect(freshRes.body.data.currentHighestBid).toBe(580);
    });
  });

  describe('Bid Rate Limiting via Redis', () => {
    it('should allow up to 10 bids per minute and block the 11th with HTTP 429', async () => {
      const auctionId = seedData.auctionId;

      // Register a dedicated user for rate limit testing
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Rate Limit Tester',
          email: 'ratelimit@bellcorp.com',
          password: 'Password123!'
        });
      const rlToken = regRes.body.data.token;

      // Dispatch 10 rapid bid requests
      let startingBid = 600;
      for (let i = 0; i < 10; i++) {
        startingBid += 10;
        const res = await request(app)
          .post(`/api/auction/${auctionId}/bids`)
          .set('Authorization', `Bearer ${rlToken}`)
          .send({ amount: startingBid });
        
        expect(res.status).toBe(201);
      }

      // 11th request in the same window should be blocked by rate limiter
      const blockedRes = await request(app)
        .post(`/api/auction/${auctionId}/bids`)
        .set('Authorization', `Bearer ${rlToken}`)
        .send({ amount: startingBid + 10 });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error).toBe('RATE_LIMIT_EXCEEDED');
      expect(blockedRes.body.message).toContain('Rate limit exceeded');
    });
  });
});
