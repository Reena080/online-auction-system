const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../src/config/postgres');
const { getRedisClient } = require('../src/config/redis');
const { getAuditCollection } = require('../src/config/mongo');
const env = require('../src/config/env');

const AUCTION_1_ID = '00000000-0000-0000-0000-000000000001';
const AUCTION_2_ID = '00000000-0000-0000-0000-000000000002';
const AUCTION_3_ID = '00000000-0000-0000-0000-000000000003';
const AUCTION_4_ID = '00000000-0000-0000-0000-000000000004';
const AUCTION_5_ID = '00000000-0000-0000-0000-000000000005';
const AUCTION_6_ID = '00000000-0000-0000-0000-000000000006';

// Core Demo Users
const USER_REENA_ID = '44444444-4444-4444-4444-444444444444';
const USER_ARJUN_ID = '55555555-5555-5555-5555-555555555555';
const USER_PRIYA_ID = '66666666-6666-6666-6666-666666666666';
const USER_RAHUL_ID = '77777777-7777-7777-7777-777777777777';

// Test Compatibility Users
const USER_A_ID = '11111111-1111-1111-1111-111111111111';
const USER_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_C_ID = '33333333-3333-3333-3333-333333333333';

const DEFAULT_AUCTIONS = [
  {
    id: AUCTION_1_ID,
    title: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Industry-leading noise cancelling wireless headphones with two processors, 8 microphones, and up to 30 hours battery life.',
    startingPrice: 20000.00,
    durationMinutes: 3,
    bids: [
      { userId: USER_ARJUN_ID, amount: 20500.00, offsetSec: 15 },
      { userId: USER_PRIYA_ID, amount: 21000.00, offsetSec: 30 },
      { userId: USER_RAHUL_ID, amount: 22000.00, offsetSec: 45 },
      { userId: USER_REENA_ID, amount: 22500.00, offsetSec: 60 }
    ]
  },
  {
    id: AUCTION_2_ID,
    title: 'iPhone 16 Pro Max 256GB',
    description: 'Flagship smartphone featuring grade 5 titanium design, A18 Pro chip, 48MP Fusion camera system, and Camera Control.',
    startingPrice: 55000.00,
    durationMinutes: 4,
    bids: [
      { userId: USER_PRIYA_ID, amount: 55500.00, offsetSec: 20 },
      { userId: USER_ARJUN_ID, amount: 57000.00, offsetSec: 40 },
      { userId: USER_RAHUL_ID, amount: 58000.00, offsetSec: 60 }
    ]
  },
  {
    id: AUCTION_3_ID,
    title: 'MacBook Air 15-inch M3 (16GB / 512GB)',
    description: 'Supercharged by Apple M3 chip, Liquid Retina display, 18 hours battery life, MagSafe charging in Midnight finish.',
    startingPrice: 75000.00,
    durationMinutes: 5,
    bids: [
      { userId: USER_RAHUL_ID, amount: 76000.00, offsetSec: 20 },
      { userId: USER_REENA_ID, amount: 78000.00, offsetSec: 50 },
      { userId: USER_PRIYA_ID, amount: 80000.00, offsetSec: 75 }
    ]
  },
  {
    id: AUCTION_4_ID,
    title: 'PlayStation 5 Pro Console',
    description: 'Next-gen gaming powerhouse with advanced ray tracing, 2TB SSD storage, and PlayStation Spectral Super Resolution (PSSR).',
    startingPrice: 40000.00,
    durationMinutes: 3,
    bids: [
      { userId: USER_ARJUN_ID, amount: 41000.00, offsetSec: 25 },
      { userId: USER_PRIYA_ID, amount: 42500.00, offsetSec: 50 }
    ]
  },
  {
    id: AUCTION_5_ID,
    title: 'Apple Watch Ultra 2 GPS + Cellular',
    description: 'The ultimate sports and adventure smartwatch with rugged titanium case, precision dual-frequency GPS, and 3000 nits display.',
    startingPrice: 25000.00,
    durationMinutes: 4,
    bids: [
      { userId: USER_RAHUL_ID, amount: 26000.00, offsetSec: 30 },
      { userId: USER_REENA_ID, amount: 27500.00, offsetSec: 60 }
    ]
  },
  {
    id: AUCTION_6_ID,
    title: 'Vintage Rolex Submariner 1968',
    description: 'Rare vintage 1968 timepiece in immaculate condition with original box, papers, and certificate of authenticity.',
    startingPrice: 500.00,
    durationMinutes: 5,
    bids: [
      { userId: USER_ARJUN_ID, amount: 550.00, offsetSec: 20 },
      { userId: USER_PRIYA_ID, amount: 650.00, offsetSec: 45 }
    ]
  }
];

async function seed(clientOrPool = null, options = {}) {
  const pool = clientOrPool || getPool();
  const client = pool.connect ? await pool.connect() : pool;
  
  console.log('[SEED] Starting database seeding with realistic demo users & bid history...');
  
  try {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    
    // 1. Seed Users (Reena + Arjun + Priya + Rahul + Test accounts)
    const users = [
      { id: USER_REENA_ID, name: 'Reena Raju Latukar', email: 'reena@example.com', password_hash: passwordHash },
      { id: USER_ARJUN_ID, name: 'Arjun Sharma', email: 'arjun.demo@example.com', password_hash: passwordHash },
      { id: USER_PRIYA_ID, name: 'Priya Nair', email: 'priya.demo@example.com', password_hash: passwordHash },
      { id: USER_RAHUL_ID, name: 'Rahul Verma', email: 'rahul.demo@example.com', password_hash: passwordHash },
      { id: USER_A_ID, name: 'Alice Walker', email: 'alice@bellcorp.com', password_hash: passwordHash },
      { id: USER_B_ID, name: 'Bob Smith', email: 'bob@bellcorp.com', password_hash: passwordHash },
      { id: USER_C_ID, name: 'Charlie Brown', email: 'charlie@bellcorp.com', password_hash: passwordHash }
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (id, name, email, password_hash, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash
      `, [u.id, u.name, u.email, u.password_hash]);
    }
    console.log(`[SEED] ${users.length} users seeded successfully.`);

    // 2. Clear old demo bids on fresh seed if clean option is passed or standard startup
    if (!options.preserveBids) {
      await client.query('DELETE FROM bids');
    }

    // 3. Seed Auctions and Realistic Bid History
    const baseStartTime = options.startTime || new Date();
    const targetAuctionId = options.auctionId || AUCTION_1_ID;
    const auditLogs = [];

    for (const item of DEFAULT_AUCTIONS) {
      const isTarget = item.id === targetAuctionId;
      const duration = (isTarget && options.durationMinutes !== undefined) 
        ? options.durationMinutes 
        : item.durationMinutes;
      const startTime = (isTarget && options.startTime) ? options.startTime : baseStartTime;
      const endTime = (isTarget && options.endTime) 
        ? options.endTime 
        : new Date(startTime.getTime() + duration * 60 * 1000);
      const startingPrice = (isTarget && options.startingPrice !== undefined) ? options.startingPrice : item.startingPrice;
      
      // Calculate highest bid and highest bidder from bid history
      const itemBids = options.preserveBids ? [] : (item.bids || []);
      const highestBidEntry = itemBids.length > 0 ? itemBids[itemBids.length - 1] : null;
      
      const currentHighestBid = (isTarget && options.currentHighestBid !== undefined)
        ? options.currentHighestBid
        : (highestBidEntry ? highestBidEntry.amount : startingPrice);
      
      const highestBidderId = (isTarget && options.highestBidderId !== undefined)
        ? options.highestBidderId
        : (highestBidEntry ? highestBidEntry.userId : null);

      const status = (isTarget && options.status) ? options.status : (endTime <= new Date() ? 'ENDED' : 'ACTIVE');

      await client.query(`
        INSERT INTO auctions (id, title, description, starting_price, current_highest_bid, highest_bidder_id, start_time, end_time, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          starting_price = EXCLUDED.starting_price,
          current_highest_bid = EXCLUDED.current_highest_bid,
          highest_bidder_id = EXCLUDED.highest_bidder_id,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          status = EXCLUDED.status
      `, [item.id, item.title, item.description, startingPrice, currentHighestBid, highestBidderId, startTime, endTime, status]);

      // Seed Bids into PostgreSQL
      const hasCustomTarget = isTarget && (options.startingPrice !== undefined || options.currentHighestBid !== undefined);
      if (!options.preserveBids && item.bids && !hasCustomTarget) {
        for (const b of item.bids) {
          const bidId = uuidv4();
          const bidTime = new Date(startTime.getTime() + (b.offsetSec || 10) * 1000);
          await client.query(`
            INSERT INTO bids (id, auction_id, bidder_id, amount, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING
          `, [bidId, item.id, b.userId, b.amount, bidTime]);

          auditLogs.push({
            event: 'BID_ACCEPTED',
            auctionId: item.id,
            userId: b.userId,
            bidId,
            amount: b.amount,
            timestamp: bidTime.toISOString(),
            metadata: { seeded: true }
          });
        }
      }

      // Sync Redis Cache if Redis client is available
      try {
        const redis = getRedisClient();
        if (redis && redis.status === 'ready') {
          await redis.del(`auction:${item.id}:highestBid`);
          await redis.set(`auction:${item.id}:highestBid`, JSON.stringify({
            highestBid: currentHighestBid,
            highestBidderId,
            status,
            endTime: endTime.toISOString()
          }));
        }
      } catch (redisErr) {
        // Ignore redis sync warning during offline seeds
      }
    }

    // Sync MongoDB Audit Logs
    try {
      const auditCollection = getAuditCollection();
      if (auditCollection && auditLogs.length > 0) {
        await auditCollection.insertMany(auditLogs, { ordered: false }).catch(() => {});
      }
    } catch (mongoErr) {
      // Ignore mongodb warning during offline seeds
    }

    console.log(`[SEED] 6 auctions and ${auditLogs.length} realistic demo bids seeded successfully.`);
    
    return {
      auctionId: targetAuctionId,
      auctions: DEFAULT_AUCTIONS,
      users
    };
  } catch (error) {
    console.error('[SEED] Seeding error:', error);
    throw error;
  } finally {
    if (client.release) {
      client.release();
    }
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  seed,
  AUCTION_1_ID,
  AUCTION_2_ID,
  AUCTION_3_ID,
  AUCTION_4_ID,
  AUCTION_5_ID,
  AUCTION_6_ID,
  DEFAULT_AUCTION_ID: AUCTION_1_ID,
  USER_REENA_ID,
  USER_ARJUN_ID,
  USER_PRIYA_ID,
  USER_RAHUL_ID,
  USER_A_ID,
  USER_B_ID,
  USER_C_ID
};
