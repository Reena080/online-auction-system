let newDb, RedisMock;
try {
  newDb = require('pg-mem').newDb;
  RedisMock = require('ioredis-mock');
} catch (e) {
  newDb = require('../server/node_modules/pg-mem').newDb;
  RedisMock = require('../server/node_modules/ioredis-mock');
}
const { setPool } = require('../server/src/config/postgres');
const { setRedisClient } = require('../server/src/config/redis');
const { setAuditCollection, clearInMemoryAuditLogs } = require('../server/src/config/mongo');
const { runMigrations } = require('../server/migrations/runMigrations');
const { seed } = require('../server/migrations/seed');

let memDb = null;
let mockRedis = null;

async function setupTestEnvironment(customSeedOptions = {}) {
  // 1. Setup in-memory PostgreSQL via pg-mem
  memDb = newDb();
  
  // Register necessary Postgres functions
  memDb.public.registerFunction({
    name: 'gen_random_uuid',
    implementation: () => require('uuid').v4()
  });

  // Create pg-mem pool
  const pgAdapter = memDb.adapters.createPg();
  const pool = new pgAdapter.Pool();

  // Inject pool into application postgres config
  setPool(pool);

  // 2. Setup Redis Mock
  mockRedis = new RedisMock();
  await mockRedis.flushall();
  setRedisClient(mockRedis);

  // 3. Setup MongoDB Mock
  clearInMemoryAuditLogs();

  // 4. Run Migrations & Seed
  await runMigrations(pool);
  const seedData = await seed(pool, customSeedOptions);

  return {
    pool,
    memDb,
    mockRedis,
    seedData
  };
}

async function cleanupTestEnvironment() {
  if (mockRedis) {
    await mockRedis.flushall();
  }
  clearInMemoryAuditLogs();
}

module.exports = {
  setupTestEnvironment,
  cleanupTestEnvironment
};
