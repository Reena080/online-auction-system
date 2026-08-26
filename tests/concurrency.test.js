const request = require('supertest');
const app = require('../server/src/app');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');
const { AUCTION_1_ID, AUCTION_2_ID, AUCTION_3_ID } = require('../server/migrations/seed');

describe('Critical Multi-Item Concurrency Race Condition Tests', () => {
  let seedData;
  let aliceToken;
  let bobToken;

  beforeEach(async () => {
    const env = await setupTestEnvironment({
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

  it('should accept exactly ONE of two simultaneous ₹65,000 bids on iPhone 16 and reject the other with 409', async () => {
    const iphoneAuctionId = AUCTION_2_ID;

    // Dispatch two simultaneous bid requests for ₹65,000 at the exact same millisecond
    const reqA = request(app)
      .post(`/api/auctions/${iphoneAuctionId}/bid`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ amount: 65000 });

    const reqB = request(app)
      .post(`/api/auctions/${iphoneAuctionId}/bid`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ amount: 65000 });

    const [resA, resB] = await Promise.all([reqA, reqB]);

    const statuses = [resA.status, resB.status].sort();
    
    // Assertion 1 & 2: Exactly one 201 ACCEPTED and one 409 CONFLICT
    expect(statuses).toEqual([201, 409]);

    const acceptedResponse = resA.status === 201 ? resA : resB;
    const rejectedResponse = resA.status === 409 ? resA : resB;

    expect(acceptedResponse.body.success).toBe(true);
    expect(acceptedResponse.body.message).toBe('Bid accepted.');
    expect(acceptedResponse.body.data.bid.amount).toBe(65000);

    expect(rejectedResponse.body.success).toBe(false);
    expect(rejectedResponse.body.error).toBe('BID_TOO_LOW');
    expect(rejectedResponse.body.message).toContain('Bid must be higher than the current highest bid');

    // Assertion 3: Final current_highest_bid = ₹65,000
    const auctionRes = await request(app).get(`/api/auctions/${iphoneAuctionId}`);
    expect(auctionRes.status).toBe(200);
    expect(auctionRes.body.data.currentHighestBid).toBe(65000);

    // Assertion 4: Only one accepted bid of ₹65,000 exists in database
    const bidsRes = await request(app).get(`/api/auctions/${iphoneAuctionId}/bids`);
    expect(bidsRes.status).toBe(200);
    const bids65k = bidsRes.body.data.filter(b => b.amount === 65000);
    expect(bids65k.length).toBe(1);

    // Assertion 5: The winning/highest bidder is exactly one user (the one whose 201 succeeded)
    const winningBidderId = acceptedResponse.body.data.bid.bidderId;
    expect(auctionRes.body.data.highestBidderId).toBe(winningBidderId);
  });

  it('should process concurrent bids across DIFFERENT auctions independently without locking each other', async () => {
    const iphoneAuctionId = AUCTION_2_ID;
    const macbookAuctionId = AUCTION_3_ID;

    // Alice bids on iPhone, Bob simultaneously bids on MacBook
    const reqIPhone = request(app)
      .post(`/api/auctions/${iphoneAuctionId}/bid`)
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ amount: 62000 });

    const reqMacBook = request(app)
      .post(`/api/auctions/${macbookAuctionId}/bid`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ amount: 85000 });

    const [resIPhone, resMacBook] = await Promise.all([reqIPhone, reqMacBook]);

    // Both should succeed with 201 Created independently
    expect(resIPhone.status).toBe(201);
    expect(resMacBook.status).toBe(201);

    expect(resIPhone.body.data.bid.amount).toBe(62000);
    expect(resMacBook.body.data.bid.amount).toBe(85000);

    // Verify independent state
    const iphoneCheck = await request(app).get(`/api/auctions/${iphoneAuctionId}`);
    const macbookCheck = await request(app).get(`/api/auctions/${macbookAuctionId}`);

    expect(iphoneCheck.body.data.currentHighestBid).toBe(62000);
    expect(iphoneCheck.body.data.highestBidderName).toBe('Alice Walker');

    expect(macbookCheck.body.data.currentHighestBid).toBe(85000);
    expect(macbookCheck.body.data.highestBidderName).toBe('Bob Smith');
  });
});
