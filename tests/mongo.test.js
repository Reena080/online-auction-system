const request = require('supertest');
const app = require('../server/src/app');
const auditService = require('../server/src/services/auditService');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');

describe('MongoDB Audit Logging Tests', () => {
  let seedData;
  let aliceToken;

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
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  it('should record audit event when a bid is placed successfully (BID_PLACED)', async () => {
    const auctionId = seedData.auctionId;

    const res = await request(app)
      .post(`/api/auction/${auctionId}/bids`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ amount: 650 });

    expect(res.status).toBe(201);

    // Verify MongoDB audit logs
    const logs = await auditService.getLogs({ event: 'BID_PLACED' });
    expect(logs.length).toBeGreaterThan(0);
    const latestLog = logs[logs.length - 1];
    expect(latestLog.event).toBe('BID_PLACED');
    expect(latestLog.amount).toBe(650);
    expect(latestLog.auctionId).toBe(auctionId);
    expect(latestLog.timestamp).toBeDefined();
  });

  it('should record audit event when a bid is rejected (BID_REJECTED)', async () => {
    const auctionId = seedData.auctionId;

    // Attempt to place a lower bid
    const res = await request(app)
      .post(`/api/auction/${auctionId}/bids`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ amount: 500 }); // Lower than 650

    expect(res.status).toBe(409);

    // Verify MongoDB audit logs
    const rejectedLogs = await auditService.getLogs({ event: 'BID_REJECTED' });
    expect(rejectedLogs.length).toBeGreaterThan(0);
    const latestRejection = rejectedLogs[rejectedLogs.length - 1];
    expect(latestRejection.event).toBe('BID_REJECTED');
    expect(latestRejection.auctionId).toBe(auctionId);
    expect(latestRejection.amount).toBe(500);
    expect(latestRejection.metadata.error).toBe('BID_TOO_LOW');
  });
});
