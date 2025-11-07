const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Product = require("./models/Product");
const User = require("./models/User");
const upload = require("./utils/upload"); // Cloudinary

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

// Сессии
app.use(session({
  secret: "exto-secret",
  resave: false,
  saveUninitialized: false
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
    console.error("❌ Ошибка получения товаров:", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Вход
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
  const { name, description, price, link } = req.body;
  const image_url = req.file?.path || null;

  console.log("📦 Данные формы (create):", { name, description, price, link });
  console.log("🖼️ Файл (create):", req.file);

  try {
    await Product.create({ name, description, price, link, image_url });
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка добавления товара:", err);
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Удаление
app.post("/admin/product/:id/delete", requireAuth, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка удаления товара:", err);
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
    console.error("❌ Ошибка получения товара для редактирования:", err);
    res.status(500).send("Ошибка базы данных");
  }
});
app.post("/admin/product/:id/edit", requireAuth, upload.single("image"), async (req, res) => {
  const { name, description, price, link, current_image } = req.body;
  const image_url = req.file?.path || current_image || null;

  console.log("📦 Данные формы (update):", { name, description, price, link, current_image });
  console.log("🖼️ Файл (update):", req.file);

  try {
    await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, link, image_url },
      { runValidators: true }
    );
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка редактирования товара:", err);
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Экспорт для Vercel
module.exports = app;
