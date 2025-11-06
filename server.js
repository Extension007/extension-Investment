const express = require("express");
const path = require("path");
const session = require("express-session");
const multer = require("multer");
const bcrypt = require("bcrypt");
const db = require("./db");

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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Настройка загрузки файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Middleware для проверки авторизации
function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect("/admin/login");
}

// Главная страница каталога
app.get("/", (req, res) => {
  db.all("SELECT * FROM products ORDER BY id DESC", [], (err, products) => {
    if (err) return res.status(500).send("Ошибка базы данных");
    res.render("index", { products, page: 1, totalPages: 1 });
  });
});

// Вход администратора
app.get("/admin/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (err) return res.status(500).send("Ошибка базы данных");
    if (user && bcrypt.compareSync(password, user.password_hash)) {
      req.session.user = user;
      res.redirect("/admin");
    } else {
      res.render("login", { error: "Неверный логин или пароль" });
    }
  });
});

// Админ-панель
app.get("/admin", requireAuth, (req, res) => {
  db.all("SELECT * FROM products ORDER BY id DESC", [], (err, products) => {
    if (err) return res.status(500).send("Ошибка базы данных");
    res.render("admin", { products });
  });
});

// Добавление товара
app.post("/admin/product", requireAuth, upload.single("image"), (req, res) => {
  const { name, description, price, link } = req.body;
  const image_path = req.file ? "/uploads/" + req.file.filename : null;
  db.run("INSERT INTO products (name, description, price, link, image_path) VALUES (?, ?, ?, ?, ?)",
    [name, description, price, link, image_path],
    (err) => {
      if (err) return res.status(500).send("Ошибка базы данных");
      res.redirect("/admin");
    }
  );
});

// Удаление товара
app.post("/admin/product/:id/delete", requireAuth, (req, res) => {
  db.run("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).send("Ошибка базы данных");
    res.redirect("/admin");
  });
});

// Форма редактирования товара
app.get("/admin/product/:id/edit", requireAuth, (req, res) => {
  db.get("SELECT * FROM products WHERE id = ?", [req.params.id], (err, product) => {
    if (err) return res.status(500).send("Ошибка базы данных");
    if (!product) return res.redirect("/admin");
    res.render("edit", { product });
  });
});

// Обновление товара
app.post("/admin/product/:id/edit", requireAuth, upload.single("image"), (req, res) => {
  const { name, description, price, link } = req.body;
  let image_path = req.body.current_image;

  if (req.file) {
    image_path = "/uploads/" + req.file.filename;
  }

  db.run(
    "UPDATE products SET name = ?, description = ?, price = ?, link = ?, image_path = ? WHERE id = ?",
    [name, description, price, link, image_path, req.params.id],
    (err) => {
      if (err) return res.status(500).send("Ошибка базы данных");
      res.redirect("/admin");
    }
  );
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен: http://localhost:${PORT}`);
});

// Экспорт для Vercel
module.exports = app;
