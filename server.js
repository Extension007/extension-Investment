// Главный файл приложения
require("dotenv").config();
const express = require("express"); // важно для Vercel
const mongoose = require("mongoose");
const { connectMongoDB } = require("./config/database");
const { app } = require("./config/app"); // берём готовый app из config/app.js

// Middleware: блокируем запросы, если база ещё не подключена
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ error: "⏳ MongoDB не подключена" });
  }
  next();
});

// Подключаем маршруты
const routes = require("./routes/index");
app.use("/", routes);

// Подключение к MongoDB при старте (важно для Vercel и локально)
(async () => {
  try {
    const { isConnected } = await connectMongoDB();
    if (!isConnected) {
      console.error("❌ Нет подключения к MongoDB");
    } else {
      console.log("✅ MongoDB подключена");
    }
  } catch (err) {
    console.error("❌ Ошибка подключения к MongoDB:", err);
  }
})();

// Экспорт приложения для Vercel
module.exports = app;

// Локальный запуск
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
  });
}
