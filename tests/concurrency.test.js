const request = require('supertest');
const app = require('../server/src/app');
const { setupTestEnvironment, cleanupTestEnvironment } = require('./testHelper');
const { AUCTION_1_ID, AUCTION_2_ID, AUCTION_3_ID, AUCTION_6_ID } = require('../server/migrations/seed');

describe('Critical Multi-Item Concurrency Race Condition Tests', () => {
  let arjunToken;
  let priyaToken;

  beforeEach(async () => {
    await setupTestEnvironment({
      durationMinutes: 60
    });

    // Login Arjun Sharma (Demo User 1)
    const resA = await request(app)
      .post('/api/auth/login')
      .send({ email: 'arjun.demo@example.com', password: 'Password123!' });
    arjunToken = resA.body.data.token;

    // Login Priya Nair (Demo User 2)
    const resB = await request(app)
      .post('/api/auth/login')
      .send({ email: 'priya.demo@example.com', password: 'Password123!' });
    priyaToken = resB.body.data.token;
  });

  afterAll(async () => {
    await cleanupTestEnvironment();
  });

  it('should accept exactly ONE of two simultaneous ₹700 bids on Rolex and reject the other with 409', async () => {
    const targetAuctionId = AUCTION_6_ID;

    // Set initial highest bid to ₹650 on Rolex
    await setupTestEnvironment({
      auctionId: targetAuctionId,
      startingPrice: 500,
      currentHighestBid: 650,
      durationMinutes: 60
    });

    // Dispatch two simultaneous bid requests for ₹700 at the exact same millisecond
    const reqA = request(app)
      .post(`/api/auctions/${targetAuctionId}/bid`)
      .set('Authorization', `Bearer ${arjunToken}`)
      .send({ amount: 700 });

    const reqB = request(app)
      .post(`/api/auctions/${targetAuctionId}/bid`)
      .set('Authorization', `Bearer ${priyaToken}`)
      .send({ amount: 700 });

    const [resA, resB] = await Promise.all([reqA, reqB]);

    const statuses = [resA.status, resB.status].sort();
    
    // Assertion 1: Exactly one 201 ACCEPTED and one 409 CONFLICT
    expect(statuses).toEqual([201, 409]);

    const acceptedResponse = resA.status === 201 ? resA : resB;
    const rejectedResponse = resA.status === 409 ? resA : resB;

    expect(acceptedResponse.body.success).toBe(true);
    expect(acceptedResponse.body.message).toBe('Bid accepted.');
    expect(acceptedResponse.body.data.bid.amount).toBe(700);

    expect(rejectedResponse.body.success).toBe(false);
    expect(rejectedResponse.body.error).toBe('BID_TOO_LOW');
    expect(rejectedResponse.body.message).toContain('Bid must be strictly higher than current highest bid');

    // Assertion 2: Final current_highest_bid = ₹700
    const auctionRes = await request(app).get(`/api/auctions/${targetAuctionId}`);
    expect(auctionRes.status).toBe(200);
    expect(auctionRes.body.data.currentHighestBid).toBe(700);

    // Assertion 3: Only one accepted bid of ₹700 exists in database
    const bidsRes = await request(app).get(`/api/auctions/${targetAuctionId}/bids`);
    expect(bidsRes.status).toBe(200);
    const bids700 = bidsRes.body.data.filter(b => b.amount === 700);
    expect(bids700.length).toBe(1);

    // Assertion 4: The winning/highest bidder is exactly one user (the one whose 201 succeeded)
    const winningBidderId = acceptedResponse.body.data.bid.bidderId;
    expect(auctionRes.body.data.highestBidderId).toBe(winningBidderId);
  });

  it('should process concurrent bids across DIFFERENT auctions independently without locking each other', async () => {
    const iphoneAuctionId = AUCTION_2_ID;
    const macbookAuctionId = AUCTION_3_ID;

    // Arjun bids on iPhone, Priya simultaneously bids on MacBook
    const reqIPhone = request(app)
      .post(`/api/auctions/${iphoneAuctionId}/bid`)
      .set('Authorization', `Bearer ${arjunToken}`)
      .send({ amount: 62000 });

    const reqMacBook = request(app)
      .post(`/api/auctions/${macbookAuctionId}/bid`)
      .set('Authorization', `Bearer ${priyaToken}`)
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
    expect(iphoneCheck.body.data.highestBidderName).toBe('Arjun Sharma');

    expect(macbookCheck.body.data.currentHighestBid).toBe(85000);
    expect(macbookCheck.body.data.highestBidderName).toBe('Priya Nair');
  });
});
