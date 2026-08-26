const request = require('supertest');
const app = require('../server/src/app');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');

describe('Critical Concurrency Race Condition Test', () => {
  let seedData;
  let aliceToken;
  let bobToken;

  beforeEach(async () => {
    // Initialize auction with starting/highest bid of ₹650
    const env = await setupTestEnvironment({
      startingPrice: 500,
      currentHighestBid: 650,
      durationMinutes: 60
    });
    seedData = env.seedData;

    // Login Alice (User A)
    const resA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@bellcorp.com', password: 'Password123!' });
    aliceToken = resA.body.data.token;

    // Login Bob (User B)
    const resB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@bellcorp.com', password: 'Password123!' });
    bobToken = resB.body.data.token;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  it('should accept exactly ONE of two simultaneous ₹700 bids on ₹650 auction and reject the other with 409', async () => {
    const auctionId = seedData.auctionId;

    // Dispatch two simultaneous bid requests for ₹700 at the exact same millisecond
    const reqA = request(app)
      .post(`/api/auction/${auctionId}/bids`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ amount: 700 });

    const reqB = request(app)
      .post(`/api/auction/${auctionId}/bids`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ amount: 700 });

    const [resA, resB] = await Promise.all([reqA, reqB]);

    const statuses = [resA.status, resB.status].sort();
    
    // Assertion 1 & 2: Exactly one 201 ACCEPTED and one 409 CONFLICT
    expect(statuses).toEqual([201, 409]);

    const acceptedResponse = resA.status === 201 ? resA : resB;
    const rejectedResponse = resA.status === 409 ? resA : resB;

    expect(acceptedResponse.body.success).toBe(true);
    expect(acceptedResponse.body.message).toBe('Bid accepted.');
    expect(acceptedResponse.body.data.bid.amount).toBe(700);

    expect(rejectedResponse.body.success).toBe(false);
    expect(rejectedResponse.body.error).toBe('BID_TOO_LOW');
    expect(rejectedResponse.body.message).toContain('Bid must be higher than the current highest bid');

    // Assertion 3: Final current_highest_bid = ₹700
    const auctionRes = await request(app).get(`/api/auction/${auctionId}`);
    expect(auctionRes.status).toBe(200);
    expect(auctionRes.body.data.currentHighestBid).toBe(700);

    // Assertion 4: Only one accepted bid of ₹700 exists in database
    const bidsRes = await request(app).get(`/api/auction/${auctionId}/bids`);
    expect(bidsRes.status).toBe(200);
    const bids700 = bidsRes.body.data.filter(b => b.amount === 700);
    expect(bids700.length).toBe(1);

    // Assertion 5: The winning/highest bidder is exactly one user (the one whose 201 succeeded)
    const winningBidderId = acceptedResponse.body.data.bid.bidderId;
    expect(auctionRes.body.data.highestBidderId).toBe(winningBidderId);
    expect(['Alice Walker', 'Bob Smith']).toContain(auctionRes.body.data.highestBidderName);
  });

  it('should maintain strict sequential consistency across a swarm of concurrent bids', async () => {
    const auctionId = seedData.auctionId;

    // Swarm of concurrent bids: User A bids 700, User B bids 700, User A bids 750, User B bids 720
    const promises = [
      request(app).post(`/api/auction/${auctionId}/bids`).set('Authorization', `Bearer ${aliceToken}`).send({ amount: 700 }),
      request(app).post(`/api/auction/${auctionId}/bids`).set('Authorization', `Bearer ${bobToken}`).send({ amount: 700 }),
      request(app).post(`/api/auction/${auctionId}/bids`).set('Authorization', `Bearer ${aliceToken}`).send({ amount: 750 }),
      request(app).post(`/api/auction/${auctionId}/bids`).set('Authorization', `Bearer ${bobToken}`).send({ amount: 720 })
    ];

    const results = await Promise.all(promises);
    
    // Check final state
    const finalAuction = await request(app).get(`/api/auction/${auctionId}`);
    expect(finalAuction.status).toBe(200);
    // The highest bid in the batch is 750
    expect(finalAuction.body.data.currentHighestBid).toBe(750);
    expect(finalAuction.body.data.highestBidderName).toBe('Alice Walker');
  });
});
