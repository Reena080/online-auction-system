const { getRedisClient } = require('../config/redis');
const { errorResponse } = require('../utils/response');

const MAX_BIDS_PER_MINUTE = 10;
const WINDOW_SECONDS = 60;

// Local in-memory rate limit bucket for fallback if Redis is unavailable
const memoryBuckets = new Map();

function cleanMemoryBuckets() {
  const now = Date.now();
  for (const [key, record] of memoryBuckets.entries()) {
    if (now > record.resetTime) {
      memoryBuckets.delete(key);
    }
  }
}

setInterval(cleanMemoryBuckets, 60000).unref();

function bidRateLimiter(options = {}) {
  const max = options.max || MAX_BIDS_PER_MINUTE;
  const windowSecs = options.windowSecs || WINDOW_SECONDS;

  return async (req, res, next) => {
    // User identifier: user ID if authenticated, else IP
    const identifier = req.user ? req.user.id : (req.ip || 'anonymous');
    const key = `ratelimit:bid:${identifier}`;

    try {
      const redis = getRedisClient();
      if (redis) {
        // Multi-command atomic increment + expire
        const pipeline = redis.pipeline();
        pipeline.incr(key);
        pipeline.ttl(key);
        const results = await pipeline.exec();

        if (results && results[0] && !results[0][0]) {
          const currentCount = results[0][1];
          const ttl = results[1][1];

          // If this is the first request in the window, set TTL
          if (ttl === -1 || currentCount === 1) {
            await redis.expire(key, windowSecs);
          }

          if (currentCount > max) {
            return errorResponse(
              res,
              429,
              'RATE_LIMIT_EXCEEDED',
              `Rate limit exceeded. Maximum ${max} bids allowed per minute. Please wait.`
            );
          }
          return next();
        }
      }
    } catch (redisErr) {
      // Redis error: fallback to memory rate limiter to keep service resilient
      if (process.env.NODE_ENV !== 'test') {
        console.warn(`[RATE_LIMIT] Redis unavailable, using memory fallback: ${redisErr.message}`);
      }
    }

    // In-memory fallback
    const now = Date.now();
    const memRecord = memoryBuckets.get(key);

    if (!memRecord || now > memRecord.resetTime) {
      memoryBuckets.set(key, { count: 1, resetTime: now + windowSecs * 1000 });
      return next();
    }

    memRecord.count += 1;
    if (memRecord.count > max) {
      return errorResponse(
        res,
        429,
        'RATE_LIMIT_EXCEEDED',
        `Rate limit exceeded. Maximum ${max} bids allowed per minute. Please wait.`
      );
    }

    next();
  };
}

module.exports = {
  bidRateLimiter
};
