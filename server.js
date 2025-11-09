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

const app = express();

// Подключение MongoDB Atlas
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB подключена"))
  .catch(err => console.error("❌ Ошибка подключения MongoDB:", err));

// Настройка шаблонов
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Парсинг форм/JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // ✅ нужно для API рейтинга

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

// favicon (глушим запросы)
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.get("/favicon.png", (req, res) => res.status(204).end());

// Middleware авторизации
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/admin/login");
}

// Главная страница — каталог
app.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    // page/totalPages оставлены для совместимости с твоим рендером
    res.render("index", { products, page: 1, totalPages: 1 });
  } catch (err) {
    console.error("❌ Ошибка получения товаров:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Вход
app.get("/admin/login", (req, res) => {
  res.render("login", { error: null, debug: null });
});

app.post("/admin/login", async (req, res) => {
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
    const products = await Product.find().sort({ _id: -1 });
    res.render("admin", { products });
  } catch (err) {
    console.error("❌ Ошибка получения товаров (админ):", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление товара
app.post("/admin/product", requireAuth, upload.single("image"), async (req, res) => {
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
    const { value } = req.body; // "like" или "dislike"
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Товар не найден" });

    if (value === "like") product.likes += 1;
    else if (value === "dislike") product.dislikes += 1;

    product.rating_updated_at = Date.now();

    await product.save();

    res.json({
      success: true,
      likes: product.likes,
      dislikes: product.dislikes,
      total: product.likes + product.dislikes,
      result: product.likes - product.dislikes // 🔹 конечный результат
    });
  } catch (err) {
    console.error("❌ Ошибка обновления рейтинга:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Получение состояния голосов
app.get("/api/rating/:id", async (req, res) => {
  try {
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
app.use((err, req, res, next) => {
  console.error("❌ Глобальная ошибка:", err);
  res.status(500).send("Внутренняя ошибка сервера");
});

// Запуск
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  });
}

// Экспорт для тестов/серверлесс
module.exports = app;
