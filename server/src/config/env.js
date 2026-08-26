const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 5000,
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'bellcorp_super_secure_jwt_secret_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // PostgreSQL
  PG_HOST: process.env.PG_HOST || 'localhost',
  PG_PORT: parseInt(process.env.PG_PORT, 10) || 5432,
  PG_DATABASE: process.env.PG_DATABASE || 'auction_db',
  PG_USER: process.env.PG_USER || 'postgres',
  PG_PASSWORD: process.env.PG_PASSWORD || 'postgres',
  PG_SSL: process.env.PG_SSL === 'true',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: parseInt(process.env.REDIS_PORT, 10) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  // MongoDB
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/auction_audit',

  // Auction
  AUCTION_DEFAULT_DURATION_MINUTES: parseInt(process.env.AUCTION_DEFAULT_DURATION_MINUTES, 10) || 60
};

module.exports = env;
