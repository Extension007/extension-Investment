// Настройка всех маршрутов приложения
const { app, CATEGORY_LABELS, CATEGORY_KEYS } = require("../config/app");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Banner = require("../models/Banner");
const User = require("../models/User");
const Statistics = require("../models/Statistics");
const cloudinary = require("cloudinary").v2;
const { HAS_MONGO } = require("../config/database");
const { deleteImages } = require("../utils/imageUtils");
const { requireAdmin, requireUser } = require("../middleware/auth");
const { csrfToken } = require("../middleware/csrf");

// Подключение роутов авторизации
const authRoutes = require("./auth");
app.use("/", authRoutes);

// Подключение API роутов
const apiRoutes = require("./api");
app.use("/api", apiRoutes);

// Подключение маршрутов кабинета пользователя
const cabinetRoutes = require("./cabinet");
app.use("/cabinet", cabinetRoutes);

// Подключение маршрутов админ-панели
const adminRoutes = require("./admin");
app.use("/admin", adminRoutes);

// Главная страница — каталог (только опубликованные карточки)
app.get("/", async (req, res) => {
  try {
    const isAuth = Boolean(req.session?.user);
    const userRole = req.session?.user?.role || null;
    const isAdmin = userRole === "admin";
    const isUser = userRole === "user";
    const selected = req.query.category;

    // Определяем категории (если не определены, используем пустой объект)
    const categories = typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {};
    const categoryKeys = typeof CATEGORY_KEYS !== 'undefined' ? CATEGORY_KEYS : [];

    if (!HAS_MONGO) {
      return res.render("index", { products: [], services: [], banners: [], visitorCount: 0, userCount: 0, page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all", csrfToken: res.locals.csrfToken });
    }

    // Проверяем подключение к БД (readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting)
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      const stateNames = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      console.warn(`⚠️ MongoDB не подключена (состояние: ${dbState} = ${stateNames[dbState] || 'unknown'}), показываем пустой каталог`);

      // Если в процессе подключения (состояние 2), ждем немного перед показом пустого каталога
      // Это дает MongoDB время на подключение при первом запросе
      if (dbState === 2) {
        // Ждем до 2 секунд для подключения
        let waited = 0;
        while (mongoose.connection.readyState === 2 && waited < 2000) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waited += 100;
        }
        // Если подключилось, продолжаем нормально
        if (mongoose.connection.readyState === 1) {
          console.log("✅ MongoDB подключилась после ожидания");
          // Продолжаем выполнение ниже
        } else {
          console.warn("⚠️ MongoDB все еще не подключена после ожидания, показываем пустой каталог");
          return res.render("index", { products: [], services: [], banners: [], visitorCount: 0, userCount: 0, page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
        }
      } else {
        // Для других состояний сразу показываем пустой каталог
        return res.render("index", { products: [], services: [], banners: [], visitorCount: 0, userCount: 0, page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
      }
    }

    // Фильтр для товаров (type: "product" или без поля type для обратной совместимости)
    const productsFilter = {
      $and: [
        {
          $or: [
            { status: "approved" },
            { status: { $exists: false } },
            { status: null }
          ]
        },
        {
          $or: [
            { type: "product" },
            { type: { $exists: false } },
            { type: null }
          ]
        }
      ]
    };

    // Фильтр для услуг (type: "service")
    const servicesFilter = {
      $and: [
        {
          $or: [
            { status: "approved" },
            { status: { $exists: false } },
            { status: null }
          ]
        },
        { type: "service" }
      ]
    };

    if (selected && categoryKeys.includes(selected)) {
      productsFilter.$and.push({ category: selected });
      servicesFilter.$and.push({ category: selected });
    }

    // Выполняем запросы с обработкой таймаутов
    let products = [];
    let services = [];
    try {
      products = await Product.find(productsFilter).sort({ _id: -1 }).maxTimeMS(5000);
      services = await Product.find(servicesFilter).sort({ _id: -1 }).maxTimeMS(5000);
    } catch (queryErr) {
      console.warn("⚠️ Ошибка запроса к БД:", queryErr.message);
      return res.render("index", { products: [], services: [], banners: [], visitorCount: 0, userCount: 0, page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
    }

    // пометим где пользователь голосовал (для товаров и услуг)
    const userId = req.session?.user?._id?.toString();
    const votedMap = {};
    [...products, ...services].forEach(p => {
      if (Array.isArray(p.voters) && p.voters.map(v => v.toString()).includes(userId)) {
        votedMap[p._id.toString()] = true;
      }
    });

    // Получаем одобренные баннеры для секции рекламы
    let approvedBanners = [];
    try {
      approvedBanners = await Banner.find({ status: "approved" }).sort({ _id: -1 }).maxTimeMS(5000);
    } catch (bannerErr) {
      console.warn("⚠️ Ошибка получения баннеров:", bannerErr.message);
    }

    // Подсчет посетителей (только один раз для каждого уникального гостя)
    let visitorCount = 0;
    try {
      // Проверяем наличие cookie, которая хранится 1 год
      const visitorCookie = req.cookies.exto_visitor;

      if (!visitorCookie) {
        // Это новый уникальный посетитель - увеличиваем счетчик
        const stats = await Statistics.findOneAndUpdate(
          { key: "visitors" },
          { $inc: { value: 1 } },
          { upsert: true, new: true }
        );
        visitorCount = stats.value;

        // Устанавливаем cookie на 1 год, чтобы гость учитывался только один раз
        res.cookie('exto_visitor', '1', {
          maxAge: 365 * 24 * 60 * 60 * 1000, // 1 год
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // только HTTPS в production
          sameSite: 'lax'
        });
      } else {
        // Гость уже был засчитан - просто получаем текущее значение
        const stats = await Statistics.findOne({ key: "visitors" });
        visitorCount = stats ? stats.value : 0;
      }
    } catch (visitorErr) {
      console.warn("⚠️ Ошибка подсчета посетителей:", visitorErr.message);
    }

    // Количество зарегистрированных пользователей
    let userCount = 0;
    try {
      userCount = await User.countDocuments({});
    } catch (userErr) {
      console.warn("⚠️ Ошибка подсчета пользователей:", userErr.message);
    }

    // page/totalPages оставлены для совместимости с твоим рендером
    res.render("index", {
      products,
      services,
      banners: approvedBanners,
      visitorCount,
      userCount,
      page: 1,
      totalPages: 1,
      isAuth,
      isAdmin,
      isUser,
      userRole,
      votedMap,
      categories,
      selectedCategory: selected || "all"
    });
  } catch (err) {
    console.error("❌ Ошибка получения товаров:", err);
    console.error("❌ Детали ошибки:", err.message);
    console.error("❌ Стек ошибки:", err.stack);

    // Пытаемся показать страницу с пустым каталогом вместо ошибки 500
    try {
      const isAuth = Boolean(req.session?.user);
      const userRole = req.session?.user?.role || null;
      const isAdmin = userRole === "admin";
      const isUser = userRole === "user";
      const selected = req.query.category || "all";
      const categories = typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {};

      // Убеждаемся, что все переменные определены
      res.render("index", {
        products: [],
        services: [],
        banners: [],
        visitorCount: 0,
        userCount: 0,
        page: 1,
        totalPages: 1,
        isAuth: isAuth || false,
        isAdmin: isAdmin || false,
        isUser: isUser || false,
        userRole: userRole || null,
        votedMap: {},
        categories: categories || {},
        selectedCategory: selected
      });
    } catch (renderErr) {
      console.error("❌ Критическая ошибка рендеринга:", renderErr);
      console.error("❌ Детали ошибки рендеринга:", renderErr.message);
      // В крайнем случае отправляем простой HTML
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Ошибка</title></head>
        <body>
          <h1>Временная ошибка сервера</h1>
          <p>Попробуйте обновить страницу через несколько секунд.</p>
        </body>
        </html>
      `);
    }
  }
});

// Health-check Cloudinary
app.get("/__health/cloudinary", async (req, res) => {
  try {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9yx7CmoAAAAASUVORK5CYII=";
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "health-check",
      transformation: [{ width: 10, height: 10, crop: "limit" }]
    });
    res.json({ ok: true, public_id: result.public_id, secure_url: result.secure_url });
  } catch (err) {
    console.error("❌ Cloudinary health error:", err);
    res.status(500).json({ ok: false, name: err.name, http_code: err.http_code, message: err.message });
  }
});

module.exports = app;
