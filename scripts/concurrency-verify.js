#!/usr/bin/env node
/**
 * Standalone Concurrency Verification Script
 * Fires two identical POST bid requests simultaneously (using Promise.all())
 * to verify that exactly ONE succeeds with HTTP 201 and the other fails with HTTP 409 Conflict.
 */

const http = require('http');

const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const SERVER_PORT = process.env.SERVER_PORT || 5000;

function httpRequest({ path, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(
      {
        host: SERVER_HOST,
        port: SERVER_PORT,
        path,
        method,
        headers: reqHeaders,
        timeout: 5000
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          try {
            const parsed = rawData ? JSON.parse(rawData) : {};
            resolve({ status: res.statusCode, body: parsed });
          } catch (e) {
            resolve({ status: res.statusCode, body: rawData });
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('\n======================================================');
  console.log('   ONLINE AUCTION CONCURRENCY & RACE CONDITION TEST   ');
  console.log('======================================================\n');
  console.log(`[TARGET SERVER] http://${SERVER_HOST}:${SERVER_PORT}`);

  try {
    // 1. Check Server Health
    const health = await httpRequest({ path: '/api/health' });
    if (health.status !== 200) {
      throw new Error(`Server health check returned HTTP ${health.status}`);
    }
    console.log('[1/5] Server is HEALTHY and listening.');

    // 2. Login User A (Arjun Sharma) and User B (Priya Nair)
    console.log('[2/5] Authenticating User A and User B concurrently...');
    const [loginResA, loginResB] = await Promise.all([
      httpRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: { email: 'arjun.demo@example.com', password: 'Password123!' }
      }),
      httpRequest({
        path: '/api/auth/login',
        method: 'POST',
        body: { email: 'priya.demo@example.com', password: 'Password123!' }
      })
    ]);

    if (loginResA.status !== 200 || loginResB.status !== 200) {
      throw new Error('Failed to login demo test accounts.');
    }

    const tokenA = loginResA.body.data.token;
    const tokenB = loginResB.body.data.token;
    const userAName = loginResA.body.data.user.name;
    const userBName = loginResB.body.data.user.name;
    console.log(`      User A: ${userAName} (Token acquired)`);
    console.log(`      User B: ${userBName} (Token acquired)`);

    // 3. Fetch Single Active Auction Details
    console.log('[3/5] Fetching current single auction item...');
    const auctionRes = await httpRequest({ path: '/api/auction' });
    if (auctionRes.status !== 200) {
      throw new Error(`Failed to fetch current auction: HTTP ${auctionRes.status}`);
    }

    const auction = Array.isArray(auctionRes.body.data) ? auctionRes.body.data[0] : auctionRes.body.data;
    const currentHighest = parseFloat(auction.currentHighestBid || auction.startingPrice || 100);
    const competingBidAmount = currentHighest + 500;
    const auctionId = auction.id;

    console.log(`      Item Name:           ${auction.title || auction.itemName}`);
    console.log(`      Item ID:             ${auctionId}`);
    console.log(`      Current Highest Bid: ₹${currentHighest.toFixed(2)}`);
    console.log(`      Competing Bid Target: ₹${competingBidAmount.toFixed(2)} (Submitted simultaneously by both users)\n`);

    // 4. Dispatch two identical POST /api/auction/bid requests simultaneously using Promise.all()
    console.log('[4/5] ⚡ DISPATCHING SIMULTANEOUS BIDS (Promise.all)...');
    console.log(`      POST /api/auction/bid -> User A: ₹${competingBidAmount.toFixed(2)}`);
    console.log(`      POST /api/auction/bid -> User B: ₹${competingBidAmount.toFixed(2)}`);

    const reqA = httpRequest({
      path: '/api/auction/bid',
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { auctionId, amount: competingBidAmount }
    });

    const reqB = httpRequest({
      path: '/api/auction/bid',
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { auctionId, amount: competingBidAmount }
    });

    const [resA, resB] = await Promise.all([reqA, reqB]);

    console.log('\n[5/5] Analyzing Server Responses:');
    console.log(`      Response User A: HTTP ${resA.status} -> ${JSON.stringify(resA.body.message || resA.body.error)}`);
    console.log(`      Response User B: HTTP ${resB.status} -> ${JSON.stringify(resB.body.message || resB.body.error)}`);

    const statuses = [resA.status, resB.status].sort();
    const exactOneWinner = statuses[0] === 201 && statuses[1] === 409;

    const acceptedRes = resA.status === 201 ? resA : resB;
    const rejectedRes = resA.status === 409 ? resA : resB;
    const winningUser = resA.status === 201 ? userAName : userBName;
    const rejectedUser = resA.status === 409 ? userAName : userBName;

    console.log('\n======================================================');
    console.log('                 VERIFICATION RESULTS                 ');
    console.log('======================================================');

    if (exactOneWinner) {
      console.log(`✅ [PASS] EXACTLY ONE BID ACCEPTED (HTTP 201): Winner = ${winningUser}`);
      console.log(`✅ [PASS] EXACTLY ONE BID REJECTED (HTTP 409 Conflict): Rejected = ${rejectedUser}`);
      console.log(`         Rejection Error: "${rejectedRes.body.message || rejectedRes.body.error}"`);
    } else {
      console.error(`❌ [FAIL] Expected [201, 409] but received [${statuses.join(', ')}]`);
      process.exit(1);
    }

    // Verify final state
    const finalAuctionRes = await httpRequest({ path: '/api/auction' });
    const finalHighest = parseFloat(finalAuctionRes.body.data.currentHighestBid);

    if (finalHighest === competingBidAmount) {
      console.log(`✅ [PASS] Authoritative Highest Bid updated to ₹${finalHighest.toFixed(2)} in database.`);
    } else {
      console.error(`❌ [FAIL] Database highest bid is ₹${finalHighest.toFixed(2)}, expected ₹${competingBidAmount.toFixed(2)}`);
      process.exit(1);
    }

    console.log('\n🎉 ALL CONCURRENCY AND TRANSACTION SAFETY CHECKS PASSED!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Concurrency verification encountered an error:', error.message);
    process.exit(1);
  }
}

runVerification();
