const fs = require('fs');
const path = require('path');
const { getPool } = require('../src/config/postgres');

async function runMigrations(clientOrPool = null) {
  const pool = clientOrPool || getPool();
  const client = pool.connect ? await pool.connect() : pool;
  
  console.log('[MIGRATION] Starting database migrations...');
  
  try {
    const migrationFiles = [
      '001_create_users.sql',
      '002_create_auctions.sql',
      '003_create_bids.sql'
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      console.log(`[MIGRATION] Applying ${file}...`);
      await client.query(sql);
    }
    
    console.log('[MIGRATION] All migrations applied successfully.');
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    throw error;
  } finally {
    if (client.release) {
      client.release();
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { runMigrations };
