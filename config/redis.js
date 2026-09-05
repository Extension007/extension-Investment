// Safe Redis client factory (optional)
const { createClient } = require('redis');

const hasRedisConfig = Boolean(
  process.env.REDIS_URL ||
  process.env.REDIS_HOST ||
  process.env.REDIS_PORT
);

let redisClient = {
  isOpen: false,
  async connect() { /* no-op */ },
  async get() { return null; },
  async setEx() { return null; },
  async del() { return 0; },
  async exists() { return 0; },
  async keys() { return []; }
};

if (hasRedisConfig) {
  try {
    const url = process.env.REDIS_URL || undefined;
    redisClient = createClient({
      url,
      socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis client error:', err.message);
    });
  } catch (err) {
    console.warn('Redis init failed, continuing without Redis:', err.message);
  }
}

const hasRedis = hasRedisConfig && typeof redisClient.connect === 'function';

module.exports = {
  redisClient,
  hasRedis
};
