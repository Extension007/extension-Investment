// Главный файл приложения
require("dotenv").config();
const express = require("express"); // важно для Vercel
const { connectMongoDB } = require("./config/database");
const { app } = require("./config/app"); // берём готовый app из config/app.js
const routes = require("./routes/index");

(async () => {
  try {
    // Подключение к MongoDB при старте
    const { isConnected } = await connectMongoDB();
    if (!isConnected) {
      console.error("❌ Нет подключения к MongoDB");
    } else {
      console.log("✅ MongoDB подключена");
    }

    // Подключаем маршруты только после подключения
    app.use("/", routes);

    // Экспорт приложения для Vercel
    module.exports = app;

    // Локальный запуск
    if (require.main === module) {
      const PORT = process.env.PORT || 3000;
      app.listen(PORT, () => {
        console.log(`Сервер запущен на http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error("❌ Ошибка подключения к MongoDB:", err);

    // Экспортируем app даже при ошибке, чтобы Vercel не падал
    module.exports = app;
  }
})();
