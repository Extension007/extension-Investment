const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

const Product = require("../config/database").Product;
const Category = require("../config/database").Category;
const User = require("../config/database").User;
const Statistics = require("../config/database").Statistics;
const { USE_POSTGRES, isDatabaseConfigured, isDbConnected, Op, sequelize } = require("../config/database");
const { CATEGORY_LABELS, CATEGORY_KEYS } = require("../config/app");
const { requireAdmin } = require("../middleware/auth");
const { buildVotedMap } = require("../services/voteService");
const { isProdLike } = require("../config/production");
const { publicProductWhere, publicServiceWhere } = require("../utils/catalogFilters");
const { localizeHierarchicalCategories, translateLabel } = require("../utils/categoryI18n");

const CATALOG_PAGE_SIZE = 24;

// Buffer visitor increments to reduce write amplification
let visitorBuffer = 0;
let visitorFlushTimer = null;
async function bumpVisitorCounter() {
  visitorBuffer += 1;
  if (visitorBuffer >= 10) {
    await flushVisitorBuffer();
    return;
  }
  if (!visitorFlushTimer) {
    visitorFlushTimer = setTimeout(() => {
      flushVisitorBuffer().catch(() => {});
    }, 15000);
    if (visitorFlushTimer.unref) visitorFlushTimer.unref();
  }
}
async function flushVisitorBuffer() {
  const n = visitorBuffer;
  visitorBuffer = 0;
  if (visitorFlushTimer) {
    clearTimeout(visitorFlushTimer);
    visitorFlushTimer = null;
  }
  if (n <= 0) return;
  try {
    const [row] = await Statistics.findOrCreate({
      where: { key: "visitors" },
      defaults: { key: "visitors", value: 0 }
    });
    await row.increment("value", { by: n });
  } catch (err) {
    console.warn("visitor flush failed:", err.message);
  }
}

const { SUPPORTED, setLocaleCookie } = require("../middleware/i18n");

router.use(require("./seo"));

router.get("/lang/:code", (req, res) => {
  const code = String(req.params.code || "").toLowerCase();
  if (!SUPPORTED.includes(code)) {
    return res.redirect("/");
  }
  setLocaleCookie(res, code);
  if (req.i18n && typeof req.i18n.changeLanguage === "function") {
    req.i18n.changeLanguage(code);
  }
  let next = String(req.query.next || "/");
  if (!next.startsWith("/") || next.startsWith("//")) {
    next = "/";
  }
  return res.redirect(next);
});

// Авторизация
router.use("/", require("./auth"));

// Mobile JSON API (must be before /api so /api/mobile is not swallowed)
router.use("/api/mobile", require("./mobile"));

// API
router.use("/api", require("./api"));

// Кабинет пользователя
router.use("/cabinet", require("./cabinet"));

// Админ-панель
router.use("/admin", require("./admin"));

// API для категорий
router.use("/api/categories", require("./categories"));
router.use("/api/locations", require("./locations"));
router.use("/api/search", require("./search"));

// Страницы с вкладками
router.use("/ad", require("./products"));
router.get("/products", (req, res) => {
  const qs = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  res.redirect(301, "/ad" + qs);
});
const servicesRouter = require("./services");
router.use("/services", servicesRouter);
router.use("/contacts", require("./contacts"));
router.get("/faq", (req, res) => {
  const { getFaqDoc, buildFaqJsonLd } = require("../utils/faqDoc");
  const faqDoc = getFaqDoc(res.locals.locale || req.locale || "en");
  const isAuth = Boolean(req.user);
  const userRole = req.user?.role || null;
  res.render("faq", {
    faqDoc,
    faqJsonLd: buildFaqJsonLd(faqDoc),
    activeTab: "faq",
    isAuth,
    isAdmin: userRole === "admin",
    isUser: userRole === "user",
    userRole,
    user: req.user || null,
    csrfToken: res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : "")
  });
});

// Публичная страница скачивания Android-приложения (ссылка для шаринга)
router.get(["/app", "/download", "/get-app"], (req, res) => {
  const isAuth = Boolean(req.user);
  const userRole = req.user?.role || null;
  res.render("app-download", {
    activeTab: "app",
    androidAppVersion: "2.0.2",
    isAuth,
    isAdmin: userRole === "admin",
    isUser: userRole === "user",
    userRole,
    user: req.user || null,
    csrfToken: res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : "")
  });
});

router.get(["/about", "/videos", "/videos/new"], (req, res) => {
  res.redirect(301, "/");
});
router.get(/^\/videos\/.+/, (req, res) => {
  res.redirect(301, "/");
});

async function resolveCategoryDisplay(selected, hasDbAccess) {
  if (!selected || selected === "all") return "all";
  if (!hasDbAccess) return selected;

  if (/^\d+$/.test(selected)) {
    try {
      const category = await Category.findByPk(parseInt(selected, 10));
      if (category?.name) return category.name;
      return "Неизвестная категория";
    } catch {
      return "Ошибка загрузки категории";
    }
  }

  return selected;
}

function applyCategoryFilter(selected, productsFilter, servicesFilter) {
  if (!selected || selected === "all") return;

  if (/^\d+$/.test(selected)) {
    const categoryId = parseInt(selected, 10);
    productsFilter.categoryId = categoryId;
    servicesFilter.categoryId = categoryId;
    return;
  }

  return Category.findOne({ where: { name: selected } }).then((category) => {
    if (category) {
      productsFilter.categoryId = category.id;
      servicesFilter.categoryId = category.id;
    }
  });
}

// Главная страница — каталог услуг
router.get("/", (req, res) => servicesRouter.renderServicesCatalog(req, res));

// Health-check Cloudinary (только для администраторов в production)
router.get("/__health/cloudinary", requireAdmin, async (req, res) => {
  try {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }

    await cloudinary.api.ping();
    res.json({ ok: true, status: "ok" });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Health-check (deep: DB ping + Redis presence)
router.get("/health", async (req, res) => {
  const configured = isDatabaseConfigured();
  let connected = isDbConnected();
  let dbPingMs = null;
  let redisOk = null;

  if (configured) {
    const started = Date.now();
    try {
      await sequelize.authenticate();
      connected = true;
      dbPingMs = Date.now() - started;
    } catch (_) {
      connected = false;
    }
  }

  if (process.env.REDIS_URL) {
    try {
      const { redisClient } = require("../config/redis");
      if (!redisClient.isOpen) await redisClient.connect();
      if (typeof redisClient.ping === "function") {
        await redisClient.ping();
      } else {
        await redisClient.get("__health__");
      }
      redisOk = true;
    } catch (_) {
      redisOk = false;
    }
  }

  const ok =
    (!configured || connected) &&
    (redisOk !== false) &&
    (!isProdLike() || configured);

  res.status(ok ? 200 : 503).json({
    ok,
    database: configured ? (connected ? "up" : "down") : "missing",
    connected,
    dbPingMs,
    redis: process.env.REDIS_URL ? (redisOk ? "up" : "down") : "not_configured",
    uptimeSec: Math.round(process.uptime()),
    nodeEnv: process.env.NODE_ENV || "development",
    vercel: Boolean(process.env.VERCEL)
  });
});

// Обработчик для Chrome DevTools и других .well-known запросов
router.get("/.well-known/*", (req, res) => {
  res.status(404).send("Not Found");
});

module.exports = router;
