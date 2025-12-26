// Главный файл приложения
require("dotenv").config();
const express = require("express"); // <-- важно для Vercel
const { connectMongoDB } = require("./config/database");
const { app } = require("./config/app"); // берём готовый app из config/app.js

// Подключаем маршруты
const routes = require("./routes/index");
app.use("/", routes);

// Экспорт приложения для Vercel
module.exports = app;

// Локальный запуск (ждём подключения к MongoDB перед стартом)
if (require.main === module) {
  (async () => {
    const { isConnected } = await connectMongoDB();
    if (isConnected) {
      console.log("✅ База данных готова к работе");
    } else {
      console.warn("⚠️ Приложение запущено без подключения к БД");
    }

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`Сервер запущен на http://localhost:${PORT}`);
    });
  })();
}
