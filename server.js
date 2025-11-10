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
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ MongoDB подключена"))
    .catch(err => console.error("❌ Ошибка подключения MongoDB:", err));
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
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://youtu.be"],
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

// Middleware авторизации
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
  if (wantsJson) return res.status(401).json({ error: "Unauthorized" });
  res.redirect("/admin/login");
}

// Главная страница — каталог
app.get("/", async (req, res) => {
  try {
    const isAuth = Boolean(req.session.user);
    const selected = req.query.category;

    if (!HAS_MONGO) {
      return res.render("index", { products: [], page: 1, totalPages: 1, isAuth, categories: CATEGORY_LABELS, selectedCategory: selected || "all" });
    }
    const filter = {};
    if (selected && CATEGORY_KEYS.includes(selected)) {
      filter.category = selected;
    }
    const products = await Product.find(filter).sort({ _id: -1 });
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
    res.render("index", { products, page: 1, totalPages: 1, isAuth, votedMap, categories: CATEGORY_LABELS, selectedCategory: selected || "all" });
  } catch (err) {
    console.error("❌ Ошибка получения товаров:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Вход
app.get("/admin/login", (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
  res.render("login", { error: null, debug: null });
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
    req.session.user = { _id: user._id, username: user.username, role: user.role };
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Ошибка регистрации:", err);
    res.status(500).json({ success: false, message: "Ошибка регистрации" });
  }
});

// Личный кабинет (простой)
app.get("/cabinet", async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Личный кабинет недоступен: нет БД");
  if (!req.session.user) return res.redirect("/admin/login"); // временно используем ту же форму входа
  try {
    const myProducts = await Product.find({ owner: req.session.user._id }).sort({ _id: -1 });
    res.render("cabinet", { user: req.session.user, products: myProducts });
  } catch (err) {
    console.error("❌ Ошибка загрузки кабинета:", err);
    res.status(500).send("Ошибка загрузки кабинета");
  }
});

// Пользователь создаёт карточку (на модерацию: owner заполняется, но можно пометить статусом далее)
app.post("/cabinet/product", upload.single("image"), async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  if (!req.session.user) return res.status(401).json({ success: false, message: "Unauthorized" });
  try {
    const { name, description, link, video_url, category } = req.body;
    const price = Number(req.body.price || 0) || 0;
    const categoryValue = CATEGORY_KEYS.includes(category) ? category : "home";
    const image_url = req.file ? req.file.path : null;
    const created = await Product.create({
      name, description, link, video_url, price, owner: req.session.user._id, category: categoryValue, image_url
    });
    res.json({ success: true, productId: created._id });
  } catch (err) {
    console.error("❌ Ошибка создания карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка создания карточки" });
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
app.post("/admin/login", async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null });
    }
    req.session.user = { _id: user._id, username: user.username };
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка входа:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Админка
app.get("/admin", requireAuth, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
    const products = await Product.find().sort({ _id: -1 });
    res.render("admin", { products });
  } catch (err) {
    console.error("❌ Ошибка получения товаров (админ):", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление товара
app.post("/admin/product", requireAuth, upload.single("image"), async (req, res) => {
  if (!HAS_MONGO) return res.status(503).send("Недоступно: отсутствует подключение к БД");
  const { name, description, price, link, video_url } = req.body;
  let image_url = null;
  try {
    if (req.file) image_url = req.file.path;
    await Product.create({
      name,
      description,
      price,
      link,
      image_url,
      video_url,
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
    if (req.file) image_url = req.file.path;
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
