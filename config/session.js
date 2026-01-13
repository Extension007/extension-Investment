// Конфигурация сессий
const session = require("express-session");
const MongoStore = require("connect-mongo");
const RedisStore = require("connect-redis").default;
const { HAS_MONGO } = require("./database");
const { redisClient } = require("./redis");

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const sessionSecret = process.env.SESSION_SECRET || "exto-secret-change-in-production";

if (isProduction) {
  const rawSessionSecret = process.env.SESSION_SECRET;
  if (!rawSessionSecret || rawSessionSecret.length < 32) {
    throw new Error('SESSION_SECRET must be set and at least 32 characters in production.');
  }
}

// Проверяем, доступен ли Redis
const hasRedis = Boolean(process.env.REDIS_HOST || process.env.REDIS_PORT);

const sessionOptions = {
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60, // 1 час
    httpOnly: true,
    secure: isProduction, // Только HTTPS в production
    sameSite: 'lax'
  }
};

if (hasRedis) {
  // Используем Redis для хранения сессий
  sessionOptions.store = new RedisStore({
    client: redisClient,
    prefix: "exto:sess:",
    ttl: 60 * 60 // 1 час в секундах
  });
  console.log("✅ Сессии хранятся в Redis");
} else if (HAS_MONGO && process.env.MONGODB_URI) {
  // Резервный вариант: MongoDB для хранения сессий
  sessionOptions.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions"
  });
  console.log("✅ Сессии хранятся в MongoDB");
} else {
  console.warn("⚠️  Ни Redis, ни MongoDB не настроены. Используется MemoryStore для сессий (только для локальной разработки).");
}

module.exports = session(sessionOptions);
