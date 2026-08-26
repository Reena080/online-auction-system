const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getPool } = require('../src/config/postgres');
const env = require('../src/config/env');

const DEFAULT_AUCTION_ID = '00000000-0000-0000-0000-000000000001';
const USER_A_ID = '11111111-1111-1111-1111-111111111111';
const USER_B_ID = '22222222-2222-2222-2222-222222222222';
const USER_C_ID = '33333333-3333-3333-3333-333333333333';

async function seed(clientOrPool = null, options = {}) {
  const pool = clientOrPool || getPool();
  const client = pool.connect ? await pool.connect() : pool;
  
  console.log('[SEED] Starting database seeding...');
  
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

    // 2. Seed Auction
    const durationMinutes = options.durationMinutes !== undefined 
      ? options.durationMinutes 
      : (parseInt(env.AUCTION_DEFAULT_DURATION_MINUTES, 10) || 60);

    const startTime = options.startTime || new Date();
    const endTime = options.endTime || new Date(startTime.getTime() + durationMinutes * 60 * 1000);
    const auctionId = options.auctionId || DEFAULT_AUCTION_ID;
    const title = options.title || 'Vintage Rolex Submariner 1968';
    const description = options.description || 'Rare vintage 1968 timepiece in immaculate condition with original box, papers, and certificate of authenticity.';
    const startingPrice = options.startingPrice !== undefined ? options.startingPrice : 500.00;
    const currentHighestBid = options.currentHighestBid !== undefined ? options.currentHighestBid : 500.00;
    const status = options.status || 'ACTIVE';

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
    `, [auctionId, title, description, startingPrice, currentHighestBid, null, startTime, endTime, status]);

    console.log(`[SEED] Auction seeded with id: ${auctionId}, duration: ${durationMinutes} mins, ends at: ${endTime.toISOString()}`);
    console.log('[SEED] Database seeding complete.');
    
    return {
      auctionId,
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

module.exports = { seed, DEFAULT_AUCTION_ID, USER_A_ID, USER_B_ID, USER_C_ID };
