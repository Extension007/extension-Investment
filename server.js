// 📂 server.js
require("dotenv").config(); // ✅ для локальной загрузки .env

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const Product = require("./models/Product");
const User = require("./models/User");
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
    mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000, // Таймаут выбора сервера 10 секунд
      socketTimeoutMS: 45000, // Таймаут сокета 45 секунд
      connectTimeoutMS: 10000, // Таймаут подключения 10 секунд
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
      scriptSrc: ["'self'", "'unsafe-inline'"], // Разрешаем inline скрипты для админ-панели и других страниц
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
      return res.render("index", { products: [], page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, categories, selectedCategory: selected || "all" });
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
          return res.render("index", { products: [], page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
        }
      } else {
        // Для других состояний сразу показываем пустой каталог
        return res.render("index", { products: [], page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
      }
    }
    
    // Показываем карточки со статусом "approved" или без статуса (для обратной совместимости)
    const filter = { 
      $or: [
        { status: "approved" },
        { status: { $exists: false } },
        { status: null }
      ]
    };
    if (selected && categoryKeys.includes(selected)) {
      filter.category = selected;
    }
    
    // Выполняем запрос с обработкой таймаутов
    let products = [];
    try {
      products = await Product.find(filter).sort({ _id: -1 }).maxTimeMS(5000); // Таймаут 5 секунд
    } catch (queryErr) {
      // Если ошибка запроса (таймаут, нет подключения и т.д.), показываем пустой каталог
      console.warn("⚠️ Ошибка запроса к БД:", queryErr.message);
      return res.render("index", { products: [], page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap: {}, categories, selectedCategory: selected || "all" });
    }
    // пометим где пользователь голосовал
    const userId = req.session.user?._id?.toString();
    const votedMap = {};
    if (userId) {
      products.forEach(p => {
        if (Array.isArray(p.voters) && p.voters.map(v => v.toString()).includes(userId)) {
          votedMap[p._id.toString()] = true;
        }
      });
    }
    // page/totalPages оставлены для совместимости с твоим рендером
    res.render("index", { products, page: 1, totalPages: 1, isAuth, isAdmin, isUser, userRole, votedMap, categories, selectedCategory: selected || "all" });
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
    const myProducts = await Product.find({ owner: req.session.user._id }).sort({ _id: -1 });
    res.render("cabinet", { user: req.session.user, products: myProducts });
  } catch (err) {
    console.error("❌ Ошибка загрузки кабинета:", err);
    res.status(500).send("Ошибка загрузки кабинета");
  }
});

// Пользователь создаёт карточку (на модерацию: статус pending)
app.post("/cabinet/product", requireUser, upload.single("image"), async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    // Проверяем, что пользователь залогинен и имеет ID
    if (!req.session.user || !req.session.user._id) {
      console.error("❌ Пользователь не авторизован или нет ID в сессии");
      return res.status(401).json({ success: false, message: "Необходима авторизация" });
    }

    const { name, description, link, video_url, category } = req.body;
    const price = Number(req.body.price || 0) || 0;
    const categoryValue = CATEGORY_KEYS.includes(category) ? category : "home";
    
    // Обрабатываем путь к изображению
    let image_url = null;
    if (req.file) {
      // Если используется Cloudinary, путь уже в req.file.path
      // Если используется локальное хранилище, нужен относительный путь
      if (req.file.path && !req.file.path.startsWith('http')) {
        // Локальное хранилище - используем относительный путь
        image_url = '/uploads/' + req.file.filename;
      } else {
        // Cloudinary - используем полный путь
        image_url = req.file.path;
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
      image_url, 
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

// Админка
app.get("/admin", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
    
    // Получаем все карточки с информацией о владельце
    const allProducts = await Product.find()
      .sort({ _id: -1 })
      .populate("owner", "username email");
    
    // Получаем карточки на модерации (со статусом pending и с owner)
    const pendingProducts = await Product.find({ 
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
    
    console.log(`📋 Всего карточек: ${allProducts.length}`);
    console.log(`⏳ На модерации: ${pendingProducts.length}`);
    
    res.render("admin", { 
      products: allProducts, 
      pendingProducts,
      categories: CATEGORY_LABELS
    });
  } catch (err) {
    console.error("❌ Ошибка получения товаров (админ):", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление товара (админом - сразу approved)
app.post("/admin/product", requireAdmin, upload.single("image"), async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Недоступно: отсутствует подключение к БД");
  const { name, description, price, link, video_url } = req.body;
  let image_url = null;
  try {
    if (req.file) {
      // Обрабатываем путь к изображению
      if (req.file.path && !req.file.path.startsWith('http')) {
        // Локальное хранилище - используем относительный путь
        image_url = '/uploads/' + req.file.filename;
      } else {
        // Cloudinary - используем полный путь
        image_url = req.file.path;
      }
    }
    await Product.create({
      name,
      description,
      price,
      link,
      image_url,
      video_url,
      status: "approved", // Админ создает сразу опубликованные
      // ✅ инициализируем счётчики голосов
      likes: 0,
      dislikes: 0
    });
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка добавления товара:", err);
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
app.post("/admin/product/:id/edit", requireAuth, upload.single("image"), async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Недоступно: отсутствует подключение к БД");
  const { name, description, price, link, video_url, current_image } = req.body;
  let image_url = current_image || null;
  try {
    if (req.file) {
      // Обрабатываем путь к изображению
      if (req.file.path && !req.file.path.startsWith('http')) {
        // Локальное хранилище - используем относительный путь
        image_url = '/uploads/' + req.file.filename;
      } else {
        // Cloudinary - используем полный путь
        image_url = req.file.path;
      }
    }
    await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, link, image_url, video_url },
      { runValidators: true }
    );
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка редактирования товара:", err);
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
