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
    console.log('[POSTGRES] Connected successfully to PostgreSQL.');
    testClient.release();

    // Auto-run migrations & seed if in dev mode
    try {
      await runMigrations(pool);
      await seed(pool);
    } catch (migErr) {
      console.warn(`[MIGRATION/SEED NOTICE] ${migErr.message}`);
    }
  } catch (pgErr) {
    console.warn(`[POSTGRES NOTICE] PostgreSQL connection not yet established (${pgErr.message}). Ensure database or docker-compose is running.`);
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
