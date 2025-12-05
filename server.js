// 📂 server.js
require("dotenv").config(); // ✅ для локальной загрузки .env

const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const Product = require("./models/Product");
const Banner = require("./models/Banner");
const User = require("./models/User");
const Statistics = require("./models/Statistics");
const upload = require("./utils/upload");
const cloudinary = require("cloudinary").v2;
const helmet = require("helmet");
const { deleteImages } = require("./utils/imageUtils");
const morgan = require("morgan");
const { csrfProtection, csrfToken } = require("./middleware/csrf");

const app = express();

// Флаг наличия строки подключения
const HAS_MONGO = Boolean(process.env.MONGODB_URI);

// Подключение MongoDB Atlas (если задано)
if (HAS_MONGO) {
  // Проверяем формат MONGODB_URI
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || !mongoUri.startsWith('mongodb')) {
    console.error("❌ Неверный формат MONGODB_URI. Ожидается строка, начинающаяся с 'mongodb://' или 'mongodb+srv://'");
    console.warn("⚠️  Приложение будет работать без БД");
  } else {
    // Увеличиваем таймауты для production (Vercel может быть медленнее)
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    const serverTimeout = isProduction ? 30000 : 10000;
    const connectTimeout = isProduction ? 30000 : 10000;
    
    mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: serverTimeout, // Таймаут выбора сервера (30s для production)
      socketTimeoutMS: 45000, // Таймаут сокета 45 секунд
      connectTimeoutMS: connectTimeout, // Таймаут подключения (30s для production)
      retryWrites: true,
      w: 'majority'
    })
      .then(() => {
        console.log("✅ MongoDB подключена");
        console.log("📊 Состояние подключения:", mongoose.connection.readyState, "(1=connected)");
        console.log("📊 Имя базы данных:", mongoose.connection.name);
      })
      .catch(err => {
        console.error("❌ Ошибка подключения MongoDB:", err.message);
        console.error("❌ Тип ошибки:", err.name);
        if (err.message.includes('authentication')) {
          console.error("⚠️  Проблема с аутентификацией. Проверьте username и password в MONGODB_URI");
        } else if (err.message.includes('timeout')) {
          console.error("⚠️  Таймаут подключения. Проверьте Network Access в MongoDB Atlas");
        } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
          console.error("⚠️  Проблема с DNS. Проверьте правильность hostname в MONGODB_URI");
        }
        console.warn("⚠️  Приложение будет работать без БД (каталог пуст, админ/рейтинг отключены).");
      });
    
    // Обработчики событий подключения
    mongoose.connection.on('connecting', () => {
      console.log("🔄 Подключение к MongoDB...");
    });
    
    mongoose.connection.on('connected', () => {
      console.log("✅ MongoDB подключена (событие)");
    });
    
    mongoose.connection.on('error', (err) => {
      console.error("❌ Ошибка MongoDB:", err.message);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn("⚠️  MongoDB отключена");
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log("🔄 MongoDB переподключена");
    });
  }
} else {
  console.warn("⚠️  MONGODB_URI не задан. Приложение запущено без БД (каталог пуст, админ/рейтинг отключены).");
}

// Настройка шаблонов
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Парсинг форм/JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // ✅ нужно для API рейтинга

// Безопасность и логирование
// FIX: CSP настроен для единой логики видео-плееров (YouTube, VK, Instagram) из public/script.js
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // FIX: Разрешаем YouTube IFrame API для единой логики видео-плееров
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://youtube.com", "https://*.youtube.com"], // Разрешаем inline скрипты и YouTube API
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://res.cloudinary.com"], // Добавляем Cloudinary
      // FIX: Разрешаем Instagram oEmbed API для единой логики видео-плееров
      connectSrc: ["'self'", "https:", "https://api.instagram.com"],
      // FIX: Разрешаем все необходимые iframe источники для YouTube, VK, Instagram
      // youtube-nocookie.com оставлен для совместимости (хотя используется youtube.com)
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://youtu.be", "https://*.youtube.com", "https://www.youtube-nocookie.com", "https://m.youtube.com", "https://vk.com", "https://*.vk.com", "https://www.instagram.com", "https://*.instagram.com"],
      mediaSrc: ["'self'", "https:"],
      objectSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(morgan("dev"));

// Справочник категорий
const CATEGORY_LABELS = {
  home: "Для дома",
  beauty: "Красота и здоровье",
  auto: "Авто мото",
  electric: "Электрика",
  electronics: "Электроника",
  plumbing: "Сантехника"
};
const CATEGORY_KEYS = Object.keys(CATEGORY_LABELS);

// Сессии (MongoDB)
const sessionOptions = {
  secret: process.env.SESSION_SECRET || "exto-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 час
};

if (process.env.MONGODB_URI) {
  sessionOptions.store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions"
  });
} else {
  console.warn("⚠️  MONGODB_URI не задан. Используется MemoryStore для сессий (только для локальной разработки).");
}

app.use(cookieParser());
app.use(session(sessionOptions));

// CSRF защита (токен доступен в шаблонах через res.locals.csrfToken)
// Применяем после cookie-parser и session, как требуется
app.use(csrfToken);

// Статика
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// favicon (глушим запросы)
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// Middleware авторизации (импортируется из middleware/auth.js)
const { requireAdmin, requireUser, requireAuth } = require("./middleware/auth");

// Главная страница — каталог (только опубликованные карточки)
app.get("/", async (req, res) => {
  try {
    const isAuth = Boolean(req.session.user);
    const userRole = req.session.user?.role || null;
    const isAdmin = userRole === "admin";
    const isUser = userRole === "user";
    const selected = req.query.category;

    // Определяем категории (если не определены, используем пустой объект)
    const categories = typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {};
    const categoryKeys = typeof CATEGORY_KEYS !== 'undefined' ? CATEGORY_KEYS : [];

    if (!HAS_MONGO) {
      return res.render("index", { products: [], services: [], banners: [], visitorCount: 0, userCount: 0, page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
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
        return res.render("index", { products: [], services: [], banners: [], page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
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
      return res.render("index", { products: [], services: [], page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
    }
    
    // пометим где пользователь голосовал (для товаров и услуг)
    const userId = req.session.user?._id?.toString();
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
      const isAuth = Boolean(req.session.user);
      const userRole = req.session.user?.role || null;
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

// ПРИМЕЧАНИЕ: Все роуты авторизации (/admin/login, /user/login, /auth/register, /logout) перенесены в routes/auth.js
// Роуты авторизации подключены через app.use("/", authRoutes);

// ПРИМЕЧАНИЕ: Все роуты /cabinet/* перенесены в routes/cabinet.js
// Роуты кабинета подключены через app.use("/cabinet", cabinetRoutes);

// ПРИМЕЧАНИЕ: Все роуты /admin/* перенесены в routes/admin.js
// Роуты админки подключены через app.use("/admin", adminRoutes);

// Подключение роутов авторизации
const authRoutes = require("./routes/auth");
app.use("/", authRoutes);

// Подключение API роутов
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

// Подключение маршрутов кабинета пользователя
const cabinetRoutes = require("./routes/cabinet");
app.use("/cabinet", cabinetRoutes);

// Подключение маршрутов админ-панели
const adminRoutes = require("./routes/admin");
app.use("/admin", adminRoutes);

// ПРИМЕЧАНИЕ: Все API роуты (/api/rating, /api/instagram/oembed, и т.д.) перенесены в routes/api.js
// API роуты подключены через app.use("/api", apiRoutes);

// ПРИМЕЧАНИЕ: Все роуты модерации /admin/* перенесены в routes/admin.js
// Роуты админки подключены через app.use("/admin", adminRoutes);

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

// Глобальный обработчик ошибок
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Запуск
if (require.main === module) {
  const BASE_PORT = Number(process.env.PORT) || 3000;

  function startServer(port, attemptsLeft = 5) {
    const server = app
      .listen(port, "0.0.0.0", () => {
        console.log(`✅ Сервер запущен на http://localhost:${port}`);
      })
      .on("error", (err) => {
        if (err && err.code === "EADDRINUSE" && attemptsLeft > 0) {
          const nextPort = port + 1;
          console.warn(`⚠️  Порт ${port} занят, пробую ${nextPort}... (${attemptsLeft - 1} попыток осталось)`);
          startServer(nextPort, attemptsLeft - 1);
        } else {
          console.error("❌ Ошибка запуска сервера:", err);
          process.exit(1);
        }
      });

    return server;
  }

  startServer(BASE_PORT);
}

// Экспорт для тестов/серверлесс
module.exports = app;
