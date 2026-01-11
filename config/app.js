const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const morgan = require("morgan");
const { createSecurityMiddleware } = require("./security");
const { HAS_MONGO } = require("./database");

const app = express();
const isVercel = Boolean(process.env.VERCEL);

// Proxy
app.set("trust proxy", isVercel ? 1 : false);

// Настройка шаблонов
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

// Парсинг форм/JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Подключение к БД для Vercel serverless
if (isVercel && HAS_MONGO) {
  const { connectMongoDB } = require("./database");
  app.use(async (req, res, next) => {
    try {
      const { isConnected } = await connectMongoDB();
      req.dbConnected = isConnected;
      next();
    } catch (err) {
      console.error("❌ Ошибка подключения к MongoDB в Vercel:", err.message);
      req.dbConnected = false;
      next();
    }
  });
}

// Безопасность и логирование
app.use(createSecurityMiddleware());
app.use(morgan("dev"));

// Категории
const CATEGORY_LABELS = {
  home: "Для дома",
  beauty: "Красота и здоровье",
  auto: "Авто мото",
  electric: "Электрика",
  electronics: "Электроника",
  plumbing: "Сантехника"
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

// Сессии
if (!isVercel) {
  const sessionOptions = {
    secret: process.env.SESSION_SECRET || "exto-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 } // 1 час
  };

  if (HAS_MONGO) {
    sessionOptions.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: "sessions",
      // Увеличим таймауты для Vercel
      touchAfter: 24 * 3600, // 24 часа
      autoRemove: 'native',
      ttl: 14 * 24 * 3600 // 14 дней
    });
  }

  app.use(cookieParser());
  app.use(session(sessionOptions));

  // Подключаем CSRF защиту
  const csrf = require('csurf');
  const csrfProtection = csrf({ cookie: true });
  app.use(csrfProtection);

  const { csrfToken } = require("../middleware/csrf");
  app.use(csrfToken);

  console.log("✅ Сессии и CSRF включены");
} else {
  app.use(cookieParser());
  console.log("⚠️ Сессии и CSRF отключены (Vercel)");
}

// Глобальные переменные для шаблонов
app.use((req, res, next) => {
  res.locals.user = isVercel
    ? (() => {
        try {
          return req.cookies.exto_user ? JSON.parse(req.cookies.exto_user) : null;
        } catch {
          res.clearCookie("exto_user");
          return null;
        }
      })()
    : req.session?.user || null;
  req.user = res.locals.user; // Для удобства в контроллерах и middleware
  
  // Передаем информацию о доступности Socket.IO в шаблоны
  res.locals.socket_io_available = !isVercel; // Socket.IO доступен только не на Vercel
  
  next();
});

// Статика
app.use(express.static(path.join(__dirname, "../public")));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Инициализация Redis кэша при старте приложения
// Redis удален из проекта
// if (!isVercel) {
//   const { redisClient } = require("./redis");
//   // Подключаемся к Redis при старте приложения
//   redisClient.connect().catch(console.error);
// }

module.exports = {
  app,
  CATEGORY_LABELS,
  CATEGORY_KEYS
};
