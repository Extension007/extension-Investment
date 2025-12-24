// Роуты для авторизации и регистрации
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { hasMongo } = require("../config/database");
const { loginLimiter } = require("../middleware/rateLimiter");
const { validateLogin, validateRegister } = require("../middleware/validators");
const { csrfProtection } = require("../middleware/csrf");

// Вход для админов (GET)
router.get("/admin/login", (req, res) => {
  if (!hasMongo()) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
  if (req.session.user && req.session.user.role === "admin") {
    return res.redirect("/admin");
  }
  res.render("login", { error: null, debug: null, csrfToken: res.locals.csrfToken });
});

// Вход для пользователей (GET)
router.get("/user/login", (req, res) => {
  if (!hasMongo()) return res.status(503).send("Вход недоступен: отсутствует подключение к БД");
  if (req.session.user) {
    return res.redirect("/cabinet");
  }
  res.render("user-login", { error: null, csrfToken: res.locals.csrfToken });
});

// Вход для админов (POST)
router.post("/admin/login", loginLimiter, csrfProtection, validateLogin, async (req, res) => {
  if (!hasMongo()) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null, csrfToken: res.locals.csrfToken });
    }
    // Проверяем роль админа
    if (user.role !== "admin") {
      return res.render("login", { error: "Доступ разрешен только администраторам", debug: null, csrfToken: res.locals.csrfToken });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null, csrfToken: res.locals.csrfToken });
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
router.post("/user/login", loginLimiter, csrfProtection, validateLogin, async (req, res) => {
  if (!hasMongo()) return res.status(503).send("Вход недоступен: отсутствует подключение к БД");
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render("user-login", { error: "Неверный логин или пароль", csrfToken: res.locals.csrfToken });
    }
    // Пользователи не могут входить через админку
    if (user.role === "admin") {
      return res.render("user-login", { error: "Для входа администратора используйте /admin/login", csrfToken: res.locals.csrfToken });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("user-login", { error: "Неверный логин или пароль", csrfToken: res.locals.csrfToken });
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

// Регистрация пользователя
router.post("/auth/register", loginLimiter, csrfProtection, validateRegister, async (req, res) => {
  if (!hasMongo()) return res.status(503).json({ success: false, message: "Регистрация недоступна: нет БД" });
  try {
    const { username, email, password } = req.body;
    
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

// Выход (logout) - POST
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Ошибка выхода:", err);
      return res.status(500).json({ success: false, message: "Ошибка выхода" });
    }
    res.json({ success: true, message: "Вы успешно вышли" });
  });
});

// Выход (logout) - GET
router.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("❌ Ошибка выхода:", err);
      return res.redirect("/");
    }
    res.redirect("/");
  });
});

module.exports = router;
