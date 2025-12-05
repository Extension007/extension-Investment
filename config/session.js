// Конфигурация сессий
const session = require("express-session");
const MongoStore = require("connect-mongo");
const { HAS_MONGO } = require("./database");

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

const sessionOptions = {
  secret: process.env.SESSION_SECRET || "exto-secret-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60, // 1 час
    httpOnly: true,
    secure: isProduction, // Только HTTPS в production
    sameSite: 'lax'
  }
};

if (HAS_MONGO && process.env.MONGODB_URI) {
  sessionOptions.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions"
  });
} else {
  console.warn("⚠️  MONGODB_URI не задан. Используется MemoryStore для сессий (только для локальной разработки).");
}

module.exports = session(sessionOptions);
