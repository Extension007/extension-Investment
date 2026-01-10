// Роуты для авторизации и регистрации
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const emailVerificationController = require("../controllers/emailVerificationController");
const { hasMongo } = require("../config/database");
const mongoose = require("mongoose");
const { loginLimiter } = require("../middleware/rateLimiter");
const { validateLogin, validateRegister } = require("../middleware/validators");
const { csrfProtection } = require("../middleware/csrf");

const isVercel = Boolean(process.env.VERCEL);

// Вход для админов (GET)
router.get("/admin/login", (req, res) => {
  const isVercel = Boolean(process.env.VERCEL);
  const hasDbAccess = isVercel ? req.dbConnected : hasMongo();
  if (req.user && req.user.role === "admin") {
    return res.redirect("/admin");
  }
  const error = hasDbAccess ? null : "Админка недоступна: отсутствует подключение к БД";
  res.render("login", { error, debug: null, csrfToken: res.locals.csrfToken });
});

// Вход для пользователей (GET)
router.get("/user/login", (req, res) => {
  const isVercel = Boolean(process.env.VERCEL);
  const hasDbAccess = isVercel ? req.dbConnected : hasMongo();
  if (req.user) {
    return res.redirect("/cabinet");
  }
  const error = hasDbAccess ? null : "База данных недоступна, вход невозможен";
  res.render("user-login", { error, csrfToken: res.locals.csrfToken });
});

router.post("/admin/login", loginLimiter, validateLogin, authController.adminLogin);
router.post("/user/login", loginLimiter, validateLogin, authController.userLogin);
router.post("/auth/register", loginLimiter, validateRegister, authController.register);
router.post("/logout", authController.logout);

// Получение CSRF токена для AJAX запросов
router.get("/csrf-token", (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

// Выход (logout) - GET
router.get("/logout", (req, res) => {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    // В Vercel serverless удаляем cookie
    res.clearCookie('exto_user');
  } else {
    // В обычной среде уничтожаем сессию
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Ошибка выхода:", err);
        return res.redirect("/");
      }
    });
  }

  res.redirect("/");
});

// Email verification routes
router.get('/auth/verify-email/:token', emailVerificationController.verifyEmail);
router.post('/auth/resend-verification', emailVerificationController.resendVerification);
router.get('/auth/verification-status', emailVerificationController.verificationStatus);

module.exports = router;
