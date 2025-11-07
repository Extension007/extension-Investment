const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const Product = require("./models/Product");
const User = require("./models/User");
const upload = require("./utils/upload"); // ✅ подключаем Cloudinary-хранилище

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка шаблонов
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Парсинг форм
app.use(express.urlencoded({ extended: true }));

// Сессии
app.use(session({
  secret: "exto-secret",
  resave: false,
  saveUninitialized: false
}));

// Статика
app.use(express.static(path.join(__dirname, "public")));
// ❌ локальная папка uploads больше не нужна
// app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/admin/login");
}

// Главная страница каталога
app.get("/", async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    res.render("index", { products, page: 1, totalPages: 1 });
  } catch (err) {
    res.status(500).send("Ошибка базы данных");
  }
});

// Вход администратора
app.get("/admin/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/admin/login", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && bcrypt.compareSync(password, user.password_hash)) {
      req.session.user = user;
      res.redirect("/admin");
    } else {
      res.render("login", { error: "Неверный логин или пароль" });
    }
  } catch (err) {
    res.status(500).send("Ошибка базы данных");
  }
});

// Админ-панель
app.get("/admin", requireAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ _id: -1 });
    res.render("admin", { products });
  } catch (err) {
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление товара
app.post("/admin/product", requireAuth, upload.single("image"), async (req, res) => {
  const { name, description, price, link } = req.body;
  const image_path = req.file?.path || null; // ✅ Cloudinary даёт публичный URL
  try {
    await Product.create({ name, description, price, link, image_path });
    res.redirect("/admin");
  } catch (err) {
    console.error("Ошибка добавления товара:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Удаление товара
app.post("/admin/product/:id/delete", requireAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    res.status(500).send("Ошибка базы данных");
  }
});

// Форма редактирования товара
app.get("/admin/product/:id/edit", requireAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.redirect("/admin");
    res.render("edit", { product });
  } catch (err) {
    res.status(500).send("Ошибка базы данных");
  }
});

// Обновление товара
app.post("/admin/product/:id/edit", requireAuth, upload.single("image"), async (req, res) => {
  const { name, description, price, link, current_image } = req.body;
  const image_path = req.file?.path || current_image; // ✅ новое фото или старое
  try {
    await Product.findByIdAndUpdate(req.params.id, { name, description, price, link, image_path });
    res.redirect("/admin");
  } catch (err) {
    console.error("Ошибка редактирования товара:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Экспорт для Vercel
module.exports = app;
