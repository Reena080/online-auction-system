const Redis = require('ioredis');
const env = require('./env');

let redisClient = null;
let isRedisConnected = false;

function getRedisClient() {
  if (!redisClient) {
    redisClient = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          console.warn('[REDIS] Connection failed after 3 retries, operating in fallback mode.');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      console.log('[REDIS] Connected successfully.');
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      // Soft log to avoid unhandled exceptions crashing the service
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[REDIS] Notice: ${err.message}`);
      }
    });

    redisClient.on('close', () => {
      isRedisConnected = false;
    });

    // Attempt initial connect without throwing
    redisClient.connect().catch((err) => {
      isRedisConnected = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[REDIS] Initial connection warning: ${err.message}`);
      }
    });
  }
  return redisClient;
}

function setRedisClient(customClient) {
  redisClient = customClient;
  isRedisConnected = true;
}

function isConnected() {
  return isRedisConnected || (redisClient && redisClient.status === 'ready');
}

async function closeRedis() {
  if (redisClient) {
    try {
      await redisClient.quit();
    } catch (e) {
      redisClient.disconnect();
    }
    redisClient = null;
    isRedisConnected = false;
  }
}

module.exports = {
  getRedisClient,
  setRedisClient,
  isConnected,
  closeRedis
};
