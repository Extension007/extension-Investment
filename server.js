// 📂 server.js
require("dotenv").config(); // ✅ для локальной загрузки .env

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const Product = require("./models/Product");
const Banner = require("./models/Banner");
const User = require("./models/User");
const Statistics = require("./models/Statistics");
const upload = require("./utils/upload");
const cloudinary = require("cloudinary").v2;
const helmet = require("helmet");
const morgan = require("morgan");

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
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://youtube.com", "https://*.youtube.com"], // Разрешаем inline скрипты и YouTube API
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://res.cloudinary.com"], // Добавляем Cloudinary
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://youtu.be", "https://*.youtube.com", "https://www.youtube-nocookie.com"],
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

app.use(session(sessionOptions));

// Статика
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// favicon (глушим запросы)
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// Middleware авторизации для админов
function requireAdmin(req, res, next) {
  if (!req.session.user) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(401).json({ error: "Unauthorized" });
    return res.redirect("/admin/login");
  }
  // Проверяем роль админа
  if (req.session.user.role !== "admin") {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(403).json({ error: "Forbidden: Admin access required" });
    return res.status(403).send("Доступ запрещен: требуется роль администратора");
  }
  next();
}

// Middleware авторизации для пользователей
function requireUser(req, res, next) {
  if (!req.session.user) {
  const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
  if (wantsJson) return res.status(401).json({ error: "Unauthorized" });
    return res.redirect("/user/login");
  }
  next();
}

// Для обратной совместимости
const requireAuth = requireAdmin;

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
    
    // Подсчет посетителей (только если еще не посещал в этой сессии)
    let visitorCount = 0;
    try {
      if (!req.session.hasVisited) {
        // Увеличиваем счетчик посетителей
        const stats = await Statistics.findOneAndUpdate(
          { key: "visitors" },
          { $inc: { value: 1 } },
          { upsert: true, new: true }
        );
        visitorCount = stats.value;
        req.session.hasVisited = true;
      } else {
        // Получаем текущее значение без увеличения
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

// Вход для админов
app.get("/admin/login", (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
  if (req.session.user && req.session.user.role === "admin") {
    return res.redirect("/admin");
  }
  res.render("login", { error: null, debug: null });
});

// Вход для пользователей
app.get("/user/login", (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Вход недоступен: отсутствует подключение к БД");
  if (req.session.user) {
    return res.redirect("/cabinet");
  }
  res.render("user-login", { error: null });
});

// Регистрация пользователя
app.post("/auth/register", async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Регистрация недоступна: нет БД" });
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: "Заполните все поля" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Пароль слишком короткий" });
    }
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      return res.status(409).json({ success: false, message: "Пользователь с таким email или никнеймом уже существует" });
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password_hash, role: "user" });
    // автологин в сессию
    req.session.user = { 
      _id: user._id.toString(), 
      username: user.username, 
      role: user.role 
    };
    console.log("✅ Пользователь зарегистрирован и залогинен:", {
      username: user.username,
      role: user.role,
      id: user._id.toString()
    });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Ошибка регистрации:", err);
    res.status(500).json({ success: false, message: "Ошибка регистрации" });
  }
});

// Личный кабинет (простой)
app.get("/cabinet", requireUser, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Личный кабинет недоступен: нет БД");
  try {
    // Разделяем товары и услуги
    const myProducts = await Product.find({ 
      owner: req.session.user._id,
      $or: [
        { type: "product" },
        { type: { $exists: false } },
        { type: null }
      ]
    }).sort({ _id: -1 });
    
    const myServices = await Product.find({ 
      owner: req.session.user._id,
      type: "service"
    }).sort({ _id: -1 });
    
    // Получаем баннеры пользователя
    const myBanners = await Banner.find({ 
      owner: req.session.user._id
    }).sort({ _id: -1 });
    
    res.render("cabinet", { user: req.session.user, products: myProducts, services: myServices || [], banners: myBanners || [] });
  } catch (err) {
    console.error("❌ Ошибка загрузки кабинета:", err);
    res.status(500).send("Ошибка загрузки кабинета");
  }
});

// Пользователь создаёт карточку (на модерацию: статус pending)
// FIX: Загрузка до 5 изображений с обработкой ошибок multer
app.post("/cabinet/product", requireUser, (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err) {
      console.error("❌ Ошибка multer при загрузке файлов:", err);
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Размер файла превышает 5MB" });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: "Неожиданное поле для загрузки файла" });
      }
      if (err.message && err.message.includes('Недопустимый тип файла')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      return res.status(400).json({ success: false, message: "Ошибка загрузки файлов: " + (err.message || "Неизвестная ошибка") });
    }
    next();
  });
}, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    console.log("📥 Получен запрос на создание карточки");
    console.log("📸 Количество файлов:", req.files ? req.files.length : 0);
    console.log("📋 Тело запроса:", req.body);
    
    // Проверяем, что пользователь залогинен и имеет ID
    if (!req.session.user || !req.session.user._id) {
      console.error("❌ Пользователь не авторизован или нет ID в сессии");
      return res.status(401).json({ success: false, message: "Необходима авторизация" });
    }

    const { name, description, link, video_url, category, phone, email, telegram, whatsapp, contact_method, type } = req.body;
    const price = Number(req.body.price || 0) || 0;
    
    // FIX: Проверка обязательных полей
    if (!name || !name.trim()) {
      console.error("❌ Отсутствует название товара/услуги");
      return res.status(400).json({ success: false, message: "Название обязательно" });
    }
    
    if (!price || price <= 0) {
      console.error("❌ Неверная цена:", price);
      return res.status(400).json({ success: false, message: "Цена должна быть больше 0" });
    }
    const categoryValue = CATEGORY_KEYS.includes(category) ? category : "home";
    const typeValue = (type === "service" || type === "product") ? type : "product";
    
    // FIX: Формируем объект контактов продавца
    const contacts = {
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      telegram: telegram ? telegram.trim() : "",
      whatsapp: whatsapp ? whatsapp.trim() : "",
      contact_method: contact_method ? contact_method.trim() : "" // FIX: Способ связи
    };
    
    // FIX: Обрабатываем массив изображений (до 5 шт.)
    let images = [];
    let image_url = null;
    
    if (req.files && req.files.length > 0) {
      // Ограничиваем до 5 изображений
      const filesToProcess = req.files.slice(0, 5);
      
      filesToProcess.forEach(file => {
        let imagePath = null;
        // Если используется Cloudinary, путь уже в file.path
        // Если используется локальное хранилище, нужен относительный путь
        if (file.path && !file.path.startsWith('http')) {
          // Локальное хранилище - используем относительный путь
          imagePath = '/uploads/' + file.filename;
        } else {
          // Cloudinary - используем полный путь
          imagePath = file.path;
        }
        if (imagePath) {
          images.push(imagePath);
        }
      });
      
      // Для обратной совместимости берем первое изображение
      if (images.length > 0) {
        image_url = images[0];
      }
    }
    
    // Используем mongoose.Types.ObjectId для правильного преобразования
    // Проверяем валидность ObjectId перед созданием
    let ownerId = null;
    if (req.session.user._id) {
      if (mongoose.isValidObjectId && mongoose.isValidObjectId(req.session.user._id)) {
        ownerId = new mongoose.Types.ObjectId(req.session.user._id);
      } else if (mongoose.Types.ObjectId.isValid(req.session.user._id)) {
        ownerId = new mongoose.Types.ObjectId(req.session.user._id);
      } else {
        ownerId = req.session.user._id;
      }
    }
    
    const productData = {
      name, 
      description, 
      link, 
      video_url, 
      price, 
      owner: ownerId, 
      category: categoryValue, 
      type: typeValue, // Тип: товар или услуга
      images, // FIX: Массив изображений (до 5 шт.)
      image_url, // FIX: Для обратной совместимости
      contacts, // FIX: Контакты продавца
      status: "pending",
      likes: 0,
      dislikes: 0
    };
    
    console.log("📝 Создание карточки пользователем:", {
      name,
      owner: ownerId.toString(),
      status: "pending",
      username: req.session.user.username,
      userId: req.session.user._id
    });
    
    const created = await Product.create(productData);
    
    // Проверяем, что карточка создана правильно
    const verify = await Product.findById(created._id).populate("owner", "username");
    
    console.log("✅ Карточка создана и проверена:", {
      id: verify._id.toString(),
      status: verify.status,
      owner: verify.owner ? verify.owner._id.toString() : "null",
      ownerUsername: verify.owner ? verify.owner.username : "не указан",
      name: verify.name
    });
    
    res.json({ success: true, productId: created._id });
  } catch (err) {
    console.error("❌ Ошибка создания карточки:", err);
    console.error("Детали ошибки:", {
      message: err.message,
      stack: err.stack,
      name: err.name
    });
    res.status(500).json({ success: false, message: "Ошибка создания карточки: " + err.message });
  }
});

// Пользователь меняет цену своей карточки
app.post("/cabinet/product/:id/price", async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  if (!req.session.user) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const price = Number(req.body.price);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ success: false, message: "Некорректная цена" });
    }
    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, owner: req.session.user._id },
      { price },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    res.json({ success: true, price: updated.price });
  } catch (err) {
    console.error("❌ Ошибка изменения цены:", err);
    res.status(500).json({ success: false, message: "Ошибка изменения цены" });
  }
});

// Получение формы редактирования товара для пользователя
app.get("/cabinet/product/:id/edit", requireUser, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Недоступно: отсутствует подключение к БД");
  try {
    const product = await Product.findOne({ _id: req.params.id, owner: req.session.user._id });
    if (!product) {
      return res.status(404).send("Карточка не найдена или у вас нет прав для редактирования");
    }
    res.render("user-edit-product", { product, user: req.session.user });
  } catch (err) {
    console.error("❌ Ошибка получения товара для редактирования:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование товара пользователем
app.post("/cabinet/product/:id/edit", requireUser, (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err) {
      console.error("❌ Ошибка multer при загрузке файлов:", err);
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Размер файла превышает 5MB" });
      }
      return res.status(400).json({ success: false, message: "Ошибка загрузки файлов: " + (err.message || "Неизвестная ошибка") });
    }
    next();
  });
}, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    // Проверяем, что пользователь является владельцем карточки
    const product = await Product.findOne({ _id: req.params.id, owner: req.session.user._id });
    if (!product) {
      return res.status(404).json({ success: false, message: "Карточка не найдена или у вас нет прав для редактирования" });
    }

    const { name, description, link, video_url, category, phone, email, telegram, whatsapp, contact_method, current_images, type } = req.body;
    const price = Number(req.body.price || 0) || 0;
    
    // Валидация
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Название товара/услуги обязательно" });
    }
    
    if (!price || price <= 0) {
      return res.status(400).json({ success: false, message: "Цена должна быть больше 0" });
    }

    const categoryValue = CATEGORY_KEYS.includes(category) ? category : product.category || "home";
    const typeValue = (type === "service" || type === "product") ? type : (product.type || "product");
    
    // Обработка изображений
    let images = [];
    
    // Если есть текущие изображения
    if (current_images) {
      try {
        const currentImagesArray = typeof current_images === 'string' 
          ? JSON.parse(current_images) 
          : Array.isArray(current_images) 
            ? current_images 
            : [];
        images = currentImagesArray.filter(img => img);
      } catch (e) {
        images = product.images || [];
      }
    } else {
      images = product.images || [];
    }

    // Добавляем новые загруженные изображения
    if (req.files && req.files.length > 0) {
      const filesToProcess = req.files.slice(0, 5);
      filesToProcess.forEach(file => {
        let imagePath = null;
        if (file.path && !file.path.startsWith('http')) {
          imagePath = '/uploads/' + file.filename;
        } else {
          imagePath = file.path;
        }
        if (imagePath) {
          images.push(imagePath);
        }
      });
      // Ограничиваем до 5 изображений
      images = images.slice(0, 5);
    }

    // Для обратной совместимости
    let image_url = images.length > 0 ? images[0] : null;
    
    // Формируем объект контактов
    const contacts = {
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      telegram: telegram ? telegram.trim() : "",
      whatsapp: whatsapp ? whatsapp.trim() : "",
      contact_method: contact_method ? contact_method.trim() : ""
    };
    
    // Обновляем карточку
    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, owner: req.session.user._id },
      { 
        name: name.trim(), 
        description: description ? description.trim() : "", 
        price, 
        link: link ? link.trim() : "", 
        video_url: video_url ? video_url.trim() : "",
        images,
        image_url,
        contacts,
        category: categoryValue,
        type: typeValue
      },
      { new: true }
    );
    
    if (!updated) {
      return res.status(404).json({ success: false, message: "Карточка не найдена" });
    }
    
    console.log("✅ Карточка обновлена пользователем:", {
      id: updated._id.toString(),
      name: updated.name,
      owner: updated.owner.toString()
    });
    
    res.json({ success: true, product: updated });
  } catch (err) {
    console.error("❌ Ошибка редактирования карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка редактирования карточки: " + err.message });
  }
});

// Загрузка баннера пользователем (на модерацию: статус pending)
app.post("/cabinet/banner", requireUser, upload.single("image"), async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    const { link } = req.body;
    
    // Валидация
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Изображение баннера обязательно" });
    }
    
    // Получаем путь к изображению
    let imageUrl = null;
    if (req.file.path && !req.file.path.startsWith('http')) {
      imageUrl = '/uploads/' + req.file.filename;
    } else {
      imageUrl = req.file.path;
    }
    
    // Используем mongoose.Types.ObjectId для правильного преобразования
    let ownerId = null;
    if (req.session.user._id) {
      if (mongoose.isValidObjectId && mongoose.isValidObjectId(req.session.user._id)) {
        ownerId = new mongoose.Types.ObjectId(req.session.user._id);
      } else if (mongoose.Types.ObjectId.isValid(req.session.user._id)) {
        ownerId = new mongoose.Types.ObjectId(req.session.user._id);
      } else {
        ownerId = req.session.user._id;
      }
    }
    
    const bannerData = {
      image_url: imageUrl,
      link: link ? link.trim() : "",
      owner: ownerId,
      status: "pending"
    };
    
    console.log("📝 Создание баннера пользователем:", {
      owner: ownerId.toString(),
      status: "pending",
      username: req.session.user.username,
      userId: req.session.user._id
    });
    
    const created = await Banner.create(bannerData);
    
    console.log("✅ Баннер создан:", {
      id: created._id.toString(),
      status: created.status,
      owner: created.owner.toString()
    });
    
    res.json({ success: true, bannerId: created._id });
  } catch (err) {
    console.error("❌ Ошибка создания баннера:", err);
    res.status(500).json({ success: false, message: "Ошибка создания баннера: " + err.message });
  }
});

// Вход для админов (POST)
app.post("/admin/login", async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null });
    }
    // Проверяем роль админа
    if (user.role !== "admin") {
      return res.render("login", { error: "Доступ разрешен только администраторам", debug: null });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null });
    }
    // Сохраняем _id как строку для совместимости
    req.session.user = { 
      _id: user._id.toString(), 
      username: user.username, 
      role: user.role 
    };
    console.log("✅ Админ залогинен:", {
      username: user.username,
      role: user.role,
      id: user._id.toString()
    });
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка входа:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Вход для пользователей (POST)
app.post("/user/login", async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Вход недоступен: отсутствует подключение к БД");
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render("user-login", { error: "Неверный логин или пароль" });
    }
    // Пользователи не могут входить через админку
    if (user.role === "admin") {
      return res.render("user-login", { error: "Для входа администратора используйте /admin/login" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("user-login", { error: "Неверный логин или пароль" });
    }
    // Сохраняем _id как строку для совместимости
    req.session.user = { 
      _id: user._id.toString(), 
      username: user.username, 
      role: user.role 
    };
    console.log("✅ Пользователь залогинен:", {
      username: user.username,
      role: user.role,
      id: user._id.toString()
    });
    res.redirect("/cabinet");
  } catch (err) {
    console.error("❌ Ошибка входа:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Выход (logout)
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Ошибка выхода:", err);
      return res.status(500).json({ success: false, message: "Ошибка выхода" });
    }
    res.json({ success: true, message: "Вы успешно вышли" });
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Ошибка выхода:", err);
      return res.redirect("/");
    }
    res.redirect("/");
  });
});

// Админка
app.get("/admin", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
    
    // Разделяем товары и услуги
    // Все товары
    const allProducts = await Product.find({
      $or: [
        { type: "product" },
        { type: { $exists: false } },
        { type: null }
      ]
    })
      .sort({ _id: -1 })
      .populate("owner", "username email");
    
    // Все услуги
    const allServices = await Product.find({
      type: "service"
    })
      .sort({ _id: -1 })
      .populate("owner", "username email");
    
    // Карточки на модерации (товары)
    const pendingProducts = await Product.find({ 
      $and: [
        { owner: { $ne: null, $exists: true } },
        {
          $or: [
            { status: "pending" },
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
    })
      .sort({ _id: -1 })
      .populate("owner", "username email");
    
    // Карточки на модерации (услуги)
    const pendingServices = await Product.find({ 
      $and: [
        { owner: { $ne: null, $exists: true } },
        {
          $or: [
            { status: "pending" },
            { status: { $exists: false } },
            { status: null }
          ]
        },
        { type: "service" }
      ]
    })
      .sort({ _id: -1 })
      .populate("owner", "username email");
    
    console.log(`📋 Всего товаров: ${allProducts.length}`);
    console.log(`🎯 Всего услуг: ${allServices.length}`);
    console.log(`⏳ Товаров на модерации: ${pendingProducts.length}`);
    console.log(`⏳ Услуг на модерации: ${pendingServices.length}`);
    
    // Получаем все баннеры
    const allBanners = await Banner.find()
      .sort({ _id: -1 })
      .populate("owner", "username email");
    
    // Баннеры на модерации
    const pendingBanners = await Banner.find({ 
      $and: [
        { owner: { $ne: null, $exists: true } },
        {
          $or: [
            { status: "pending" },
            { status: { $exists: false } },
            { status: null }
          ]
        }
      ]
    })
      .sort({ _id: -1 })
      .populate("owner", "username email");
    
    console.log(`📋 Всего баннеров: ${allBanners.length}`);
    console.log(`⏳ Баннеров на модерации: ${pendingBanners.length}`);
    
    res.render("admin", { 
      products: allProducts, 
      services: allServices || [],
      pendingProducts,
      pendingServices: pendingServices || [],
      banners: allBanners || [],
      pendingBanners: pendingBanners || [],
      categories: CATEGORY_LABELS
    });
  } catch (err) {
    console.error("❌ Ошибка получения товаров (админ):", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление товара (админом - сразу approved)
app.post("/admin/product", requireAdmin, (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err) {
      console.error("❌ Ошибка multer при загрузке файлов:", err);
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Размер файла превышает 5MB" });
      }
      return res.status(400).json({ success: false, message: "Ошибка загрузки файлов: " + (err.message || "Неизвестная ошибка") });
    }
    next();
  });
}, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
  try {
    const { name, description, price, link, video_url, category, phone, email, telegram, whatsapp, contact_method, type } = req.body;
    
    // Валидация
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Название товара/услуги обязательно" });
    }
    
    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) {
      return res.status(400).json({ success: false, message: "Цена должна быть больше 0" });
    }

    const categoryValue = CATEGORY_KEYS.includes(category) ? category : "home";
    const typeValue = (type === "service" || type === "product") ? type : "product";
    
    // Обработка изображений
    let images = [];
    let image_url = null;
    
    if (req.files && req.files.length > 0) {
      const filesToProcess = req.files.slice(0, 5);
      filesToProcess.forEach(file => {
        let imagePath = null;
        if (file.path && !file.path.startsWith('http')) {
          imagePath = '/uploads/' + file.filename;
        } else {
          imagePath = file.path;
        }
        if (imagePath) {
          images.push(imagePath);
        }
      });
      
      if (images.length > 0) {
        image_url = images[0];
      }
    }
    
    // Формируем объект контактов
    const contacts = {
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      telegram: telegram ? telegram.trim() : "",
      whatsapp: whatsapp ? whatsapp.trim() : "",
      contact_method: contact_method ? contact_method.trim() : ""
    };
    
    await Product.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      price: priceNum,
      link: link ? link.trim() : "",
      video_url: video_url ? video_url.trim() : "",
      images,
      image_url,
      contacts,
      category: categoryValue,
      type: typeValue, // Тип: товар или услуга
      status: "approved", // Админ создает сразу опубликованные
      likes: 0,
      dislikes: 0
    });
    
    // Проверяем, является ли запрос AJAX
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, message: "Товар успешно добавлен" });
    }
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка добавления товара:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ success: false, message: "Ошибка добавления товара: " + err.message });
    }
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Удаление товара
app.post("/admin/product/:id/delete", requireAuth, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).send("Недоступно: отсутствует подключение к БД");
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка удаления товара:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование товара (форма)
app.get("/admin/product/:id/edit", requireAuth, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).send("Недоступно: отсутствует подключение к БД");
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/admin");
    res.render("edit", { product });
  } catch (err) {
    console.error("❌ Ошибка получения товара для редактирования:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование товара (сохранение)
app.post("/admin/product/:id/edit", requireAuth, (req, res, next) => {
  upload.array("images", 5)(req, res, (err) => {
    if (err) {
      console.error("❌ Ошибка multer при загрузке файлов:", err);
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: "Размер файла превышает 5MB" });
      }
      return res.status(400).json({ success: false, message: "Ошибка загрузки файлов: " + (err.message || "Неизвестная ошибка") });
    }
    next();
  });
}, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) {
        return res.status(404).json({ success: false, message: "Товар не найден" });
      }
      return res.redirect("/admin");
    }

    const { name, description, price, link, video_url, category, phone, email, telegram, whatsapp, contact_method, current_images, type } = req.body;
    
    // Валидация
    if (!name || !name.trim()) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) {
        return res.status(400).json({ success: false, message: "Название товара обязательно" });
      }
      return res.redirect("/admin");
    }

    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) {
        return res.status(400).json({ success: false, message: "Цена должна быть больше 0" });
      }
      return res.redirect("/admin");
    }

    const categoryValue = CATEGORY_KEYS.includes(category) ? category : product.category || "home";
    const typeValue = (type === "service" || type === "product") ? type : (product.type || "product");
    
    // Обработка изображений
    let images = [];
    
    // Если есть текущие изображения
    if (current_images) {
      try {
        const currentImagesArray = typeof current_images === 'string' 
          ? JSON.parse(current_images) 
          : Array.isArray(current_images) 
            ? current_images 
            : [];
        images = currentImagesArray.filter(img => img);
      } catch (e) {
        images = product.images || [];
      }
    } else {
      images = product.images || [];
    }

    // Добавляем новые загруженные изображения
    if (req.files && req.files.length > 0) {
      const filesToProcess = req.files.slice(0, 5);
      filesToProcess.forEach(file => {
        let imagePath = null;
        if (file.path && !file.path.startsWith('http')) {
          imagePath = '/uploads/' + file.filename;
        } else {
          imagePath = file.path;
        }
        if (imagePath) {
          images.push(imagePath);
        }
      });
      // Ограничиваем до 5 изображений
      images = images.slice(0, 5);
    }

    // Для обратной совместимости
    let image_url = images.length > 0 ? images[0] : null;
    
    // Формируем объект контактов
    const contacts = {
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      telegram: telegram ? telegram.trim() : "",
      whatsapp: whatsapp ? whatsapp.trim() : "",
      contact_method: contact_method ? contact_method.trim() : ""
    };
    
    await Product.findByIdAndUpdate(
      req.params.id,
      { 
        name: name.trim(), 
        description: description ? description.trim() : "", 
        price: priceNum, 
        link: link ? link.trim() : "", 
        video_url: video_url ? video_url.trim() : "",
        images,
        image_url,
        contacts,
        category: categoryValue,
        type: typeValue
      },
      { runValidators: true }
    );
    
    // Проверяем, является ли запрос AJAX
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, message: "Товар успешно обновлен" });
    }
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка редактирования товара:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ success: false, message: "Ошибка редактирования товара: " + err.message });
    }
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// 📌 Голосование (лайки/дизлайки → возвращаем результат и общее количество голосов)
app.post("/api/rating/:id", async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ success: false, message: "Голосование доступно только зарегистрированным пользователям" });
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Рейтинг недоступен: нет БД" });
    const { value } = req.body; // "like" или "dislike"
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Товар не найден" });

    // один голос на пользователя
    const userId = req.session.user._id.toString();
    const already = (product.voters || []).map(v => v.toString()).includes(userId);
    if (already) {
      return res.status(409).json({ success: false, message: "Вы уже голосовали за этот товар" });
    }

    if (value === "like") product.likes += 1;
    else if (value === "dislike") product.dislikes += 1;

    product.rating_updated_at = Date.now();
    product.voters = product.voters || [];
    product.voters.push(req.session.user._id);

    await product.save();

    res.json({
      success: true,
      likes: product.likes,
      dislikes: product.dislikes,
      total: product.likes + product.dislikes,
      result: product.likes - product.dislikes, // 🔹 конечный результат
      voted: true
    });
  } catch (err) {
    console.error("❌ Ошибка обновления рейтинга:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Получение состояния голосов
app.get("/api/rating/:id", async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Рейтинг недоступен: нет БД" });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Товар не найден" });

    res.json({
      success: true,
      likes: product.likes,
      dislikes: product.dislikes,
      total: product.likes + product.dislikes,
      result: product.likes - product.dislikes
    });
  } catch (err) {
    console.error("❌ Ошибка получения рейтинга:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Модерация: одобрить карточку
app.post("/admin/product/:id/approve", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejection_reason: "" },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    res.json({ success: true, status: product.status });
  } catch (err) {
    console.error("❌ Ошибка одобрения карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка одобрения карточки" });
  }
});

// Модерация: отклонить карточку
app.post("/admin/product/:id/reject", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const { reason } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejection_reason: reason || "Несоответствие правилам публикации" },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    res.json({ success: true, status: product.status, rejection_reason: product.rejection_reason });
  } catch (err) {
    console.error("❌ Ошибка отклонения карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка отклонения карточки" });
  }
});

// Модерация баннеров: одобрить баннер
app.post("/admin/banner/:id/approve", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejection_reason: "" },
      { new: true }
    );
    if (!banner) return res.status(404).json({ success: false, message: "Баннер не найден" });
    res.json({ success: true, status: banner.status });
  } catch (err) {
    console.error("❌ Ошибка одобрения баннера:", err);
    res.status(500).json({ success: false, message: "Ошибка одобрения баннера" });
  }
});

// Модерация баннеров: отклонить баннер
app.post("/admin/banner/:id/reject", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const { reason } = req.body;
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejection_reason: reason || "Несоответствие правилам публикации" },
      { new: true }
    );
    if (!banner) return res.status(404).json({ success: false, message: "Баннер не найден" });
    res.json({ success: true, status: banner.status, rejection_reason: banner.rejection_reason });
  } catch (err) {
    console.error("❌ Ошибка отклонения баннера:", err);
    res.status(500).json({ success: false, message: "Ошибка отклонения баннера" });
  }
});

// Блокировка карточки (скрытие с главной страницы)
app.post("/admin/product/:id/toggle-visibility", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    
    // Если карточка approved, меняем на rejected (блокируем)
    // Если rejected, меняем на approved (разблокируем)
    const newStatus = product.status === "approved" ? "rejected" : "approved";
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { status: newStatus, rejection_reason: newStatus === "rejected" ? "Заблокировано администратором" : "" },
      { new: true }
    );
    
    res.json({ success: true, status: updated.status, message: newStatus === "rejected" ? "Карточка заблокирована" : "Карточка разблокирована" });
  } catch (err) {
    console.error("❌ Ошибка блокировки карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка блокировки карточки" });
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
