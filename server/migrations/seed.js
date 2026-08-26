const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../src/config/postgres');
const env = require('../src/config/env');

const AUCTION_1_ID = '00000000-0000-0000-0000-000000000001';
const AUCTION_2_ID = '00000000-0000-0000-0000-000000000002';
const AUCTION_3_ID = '00000000-0000-0000-0000-000000000003';
const AUCTION_4_ID = '00000000-0000-0000-0000-000000000004';
const AUCTION_5_ID = '00000000-0000-0000-0000-000000000005';
const AUCTION_6_ID = '00000000-0000-0000-0000-000000000006';

const USER_A_ID = '11111111-1111-1111-1111-111111111111';
const USER_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_C_ID = '33333333-3333-3333-3333-333333333333';

const DEFAULT_AUCTIONS = [
  {
    id: AUCTION_1_ID,
    title: 'Sony WH-1000XM5 Wireless Headphones',
    description: 'Industry-leading noise cancelling wireless headphones with two processors, 8 microphones, and up to 30 hours battery life.',
    startingPrice: 20000.00,
    currentHighestBid: 20000.00,
    durationMinutes: 120
  },
  {
    id: AUCTION_2_ID,
    title: 'iPhone 16 Pro Max 256GB',
    description: 'Flagship smartphone featuring grade 5 titanium design, A18 Pro chip, 48MP Fusion camera system, and Camera Control.',
    startingPrice: 55000.00,
    currentHighestBid: 55000.00,
    durationMinutes: 180
  },
  {
    id: AUCTION_3_ID,
    title: 'MacBook Air 15-inch M3 (16GB / 512GB)',
    description: 'Supercharged by Apple M3 chip, Liquid Retina display, 18 hours battery life, MagSafe charging in Midnight finish.',
    startingPrice: 75000.00,
    currentHighestBid: 75000.00,
    durationMinutes: 240
  },
  {
    id: AUCTION_4_ID,
    title: 'PlayStation 5 Pro Console',
    description: 'Next-gen gaming powerhouse with advanced ray tracing, 2TB SSD storage, and PlayStation Spectral Super Resolution (PSSR).',
    startingPrice: 40000.00,
    currentHighestBid: 40000.00,
    durationMinutes: 300
  },
  {
    id: AUCTION_5_ID,
    title: 'Apple Watch Ultra 2 GPS + Cellular',
    description: 'The ultimate sports and adventure smartwatch with rugged titanium case, precision dual-frequency GPS, and 3000 nits display.',
    startingPrice: 25000.00,
    currentHighestBid: 25000.00,
    durationMinutes: 360
  },
  {
    id: AUCTION_6_ID,
    title: 'Vintage Rolex Submariner 1968',
    description: 'Rare vintage 1968 timepiece in immaculate condition with original box, papers, and certificate of authenticity.',
    startingPrice: 500.00,
    currentHighestBid: 500.00,
    durationMinutes: 60
  }
];

async function seed(clientOrPool = null, options = {}) {
  const pool = clientOrPool || getPool();
  const client = pool.connect ? await pool.connect() : pool;
  
  console.log('[SEED] Starting database seeding with multiple auction items...');
  
  try {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    
    // 1. Seed Users
    const users = [
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
    console.log('[SEED] Users seeded.');

    // 2. Seed Auctions
    const baseStartTime = options.startTime || new Date();
    const targetAuctionId = options.auctionId || AUCTION_1_ID;

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
      const currentHighestBid = (isTarget && options.currentHighestBid !== undefined) ? options.currentHighestBid : item.currentHighestBid;
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
      `, [item.id, item.title, item.description, startingPrice, currentHighestBid, null, startTime, endTime, status]);
    }

    console.log(`[SEED] ${DEFAULT_AUCTIONS.length} auctions seeded successfully.`);
    
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
  USER_A_ID,
  USER_B_ID,
  USER_C_ID
};
