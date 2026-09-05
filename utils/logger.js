const pino = require('pino');

// Minimal structured logger configuration
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // do not include pid/hostname to keep logs clean for serverless
  timestamp: () => `,"time":"${new Date().toISOString()}"`
});

module.exports = logger;
