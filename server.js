require("dotenv").config(); // ✅ добавлено для локальной загрузки .env

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const Product = require("./models/Product");
const User = require("./models/User");
const upload = require("./utils/upload");

const app = express();

// Подключение MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB подключена"))
.catch(err => console.error("❌ Ошибка подключения MongoDB:", err));

// Настройка шаблонов
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Парсинг форм
app.use(express.urlencoded({ extended: true }));

// Сессии (MongoDB)
app.use(session({
  secret: "exto-secret",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions"
  }),
  cookie: { maxAge: 1000 * 60 * 60 } // 1 час
}));

// Статика
app.use(express.static(path.join(__dirname, "public")));

// favicon
app.get("/favicon.ico", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "favicon.ico"));
});
app.get("/favicon.png", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "favicon.png"));
});

// Middleware авторизации
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/admin/login");
}

// Главная страница
app.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    res.render("index", { products, page: 1, totalPages: 1 });
  } catch (err) {
    console.error("❌ Ошибка получения товаров:", err.message);
    res.status(500).send("Ошибка базы данных");
  }
});

// Вход
app.get("/admin/login", (req, res) => {
  res.render("login", { error: null, debug: null });
});

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  console.log("🛂 Получено:", req.body);

  try {
    const user = await User.findOne({ username });
    console.log("🔎 Найден пользователь:", user);

    if (!user) {
      return res.render("login", { 
        error: "Неверный логин или пароль", 
        debug: { body: req.body, user: null }
      });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    console.log("🔐 Сравнение пароля:", ok);

    if (!ok) {
      return res.render("login", { 
        error: "Неверный логин или пароль", 
        debug: { body: req.body, user, compare: false }
      });
    }

    req.session.user = { _id: user._id, username: user.username };
    console.log("✅ Сессия установлена:", req.session.user);
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка входа:", err.message);
    res.status(500).send("Ошибка базы данных");
  }
});

// Админка
app.get("/admin", requireAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    res.render("admin", { products });
  } catch (err) {
    console.error("❌ Ошибка получения товаров (админ):", err.message);
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление товара
app.post("/admin/product", requireAuth, upload.single("image"), async (req, res) => {
  const { name, description, price, link } = req.body;
  let image_url = null;

  console.log("📦 Данные формы (create):", { name, description, price, link });
  console.log("🖼️ Файл (create):", req.file);

  try {
    if (req.file) {
      image_url = req.file.path || req.file.url; // ✅ ссылка Cloudinary
      console.log("✅ Cloudinary URL:", image_url);
    }

    await Product.create({ name, description, price, link, image_url });
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка добавления товара:", err.message, err.stack);
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Удаление
app.post("/admin/product/:id/delete", requireAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка удаления товара:", err.message);
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование
app.get("/admin/product/:id/edit", requireAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/admin");
    res.render("edit", { product });
  } catch (err) {
    console.error("❌ Ошибка получения товара для редактирования:", err.message);
    res.status(500).send("Ошибка базы данных");
  }
});

app.post("/admin/product/:id/edit", requireAuth, upload.single("image"), async (req, res) => {
  const { name, description, price, link, current_image } = req.body;
  let image_url = current_image || null;

  console.log("📦 Данные формы (update):", { name, description, price, link, current_image });
  console.log("🖼️ Файл (update):", req.file);

  try {
    if (req.file) {
      image_url = req.file.path || req.file.url; // ✅ ссылка Cloudinary
      console.log("✅ Cloudinary URL:", image_url);
    }

    await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, link, image_url },
      { runValidators: true }
    );
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка редактирования товара:", err.message, err.stack);
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Экспорт для Vercel
module.exports = app;
