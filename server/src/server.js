const app = require('./app');
const env = require('./config/env');
const { getPool, closePool } = require('./config/postgres');
const { getRedisClient, closeRedis } = require('./config/redis');
const { connectMongo, closeMongo } = require('./config/mongo');
const { runMigrations } = require('../migrations/runMigrations');
const { seed } = require('../migrations/seed');

let server = null;

async function bootstrap() {
  console.log('====================================================');
  console.log('       ONLINE AUCTION SYSTEM - SERVER STARTUP        ');
  console.log('====================================================');
  console.log(`[ENVIRONMENT] Node Environment: ${env.NODE_ENV}`);
  console.log(`[CONFIG] Port: ${env.PORT}`);
  console.log(`[CONFIG] Postgres Host: ${env.PG_HOST}:${env.PG_PORT} (DB: ${env.PG_DATABASE})`);
  console.log(`[CONFIG] Redis Host: ${env.REDIS_HOST}:${env.REDIS_PORT}`);
  console.log(`[CONFIG] Mongo URI: ${env.MONGO_URI}`);
  console.log('----------------------------------------------------');

  // 1. Initialize PostgreSQL & run migrations/seed
  try {
    const pool = getPool();
    const testClient = await pool.connect();
    console.log('[POSTGRES] Connected successfully to external PostgreSQL.');
    testClient.release();

    // Auto-run migrations & seed
    try {
      await runMigrations(pool);
      await seed(pool);
    } catch (migErr) {
      console.warn(`[MIGRATION/SEED NOTICE] ${migErr.message}`);
    }
  } catch (pgErr) {
    console.log(`[POSTGRES] External database unavailable (${pgErr.message}).`);
    console.log('[POSTGRES] Initializing built-in database engine with schema and seed data...');
    try {
      const { newDb } = require('pg-mem');
      const { setPool } = require('./config/postgres');
      const memDb = newDb();
      memDb.public.registerFunction({
        name: 'gen_random_uuid',
        implementation: () => require('uuid').v4()
      });
      const pgAdapter = memDb.adapters.createPg();
      const fallbackPool = new pgAdapter.Pool();
      setPool(fallbackPool);

      await runMigrations(fallbackPool);
      await seed(fallbackPool);
      console.log('[POSTGRES] Built-in database engine is ready and active.');
    } catch (fallbackErr) {
      console.error('[POSTGRES ERROR] Failed to initialize fallback engine:', fallbackErr);
    }
  }

  // 2. Initialize Redis
  try {
    getRedisClient();
  } catch (redisErr) {
    console.warn(`[REDIS NOTICE] ${redisErr.message}`);
  }

  // 3. Initialize MongoDB
  try {
    await connectMongo();
  } catch (mongoErr) {
    console.warn(`[MONGODB NOTICE] ${mongoErr.message}`);
  }

  // 4. Start HTTP Server
  server = app.listen(env.PORT, () => {
    console.log(`[SERVER] Online Auction System backend running at http://localhost:${env.PORT}`);
    console.log(`[SERVER] Health check: http://localhost:${env.PORT}/api/health`);
    console.log(`[SERVER] Auction API: http://localhost:${env.PORT}/api/auction`);
    console.log('====================================================');
  });

  // 5. Automatic Auction Expiration Worker (Periodic sweeper)
  const auctionService = require('./services/auctionService');
  const expiryInterval = setInterval(async () => {
    try {
      const expiredCount = await auctionService.processExpiredAuctions();
      if (expiredCount > 0) {
        console.log(`[AUCTION_EXPIRY_WORKER] Automatically marked ${expiredCount} expired auction(s) as ENDED.`);
      }
    } catch (err) {
      // Ignored
    }
  }, 5000);
  expiryInterval.unref();

  // Graceful shutdown handlers
  const handleShutdown = async (signal) => {
    console.log(`\n[SERVER] Received ${signal}. Initiating graceful shutdown...`);
    if (server) {
      server.close(async () => {
        console.log('[SERVER] HTTP server closed.');
        await closePool();
        await closeRedis();
        await closeMongo();
        console.log('[SERVER] All database and cache connections closed. Exiting process.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('[FATAL] Failed to bootstrap server:', err);
  process.exit(1);
});
