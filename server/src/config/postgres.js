const { Pool } = require('pg');
const env = require('./env');

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      host: env.PG_HOST,
      port: env.PG_PORT,
      database: env.PG_DATABASE,
      user: env.PG_USER,
      password: env.PG_PASSWORD,
      ssl: env.PG_SSL ? { rejectUnauthorized: false } : false,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('[POSTGRES] Unexpected error on idle client:', err.message);
    });
  }
  return pool;
}

function setPool(customPool) {
  pool = customPool;
}

async function query(text, params) {
  const p = getPool();
  return p.query(text, params);
}

async function getClient() {
  const p = getPool();
  return p.connect();
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPool,
  setPool,
  query,
  getClient,
  closePool
};
