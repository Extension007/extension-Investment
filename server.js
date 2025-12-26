// Главный файл приложения
require("dotenv").config();
const express = require("express"); // важно для Vercel
const { connectMongoDB } = require("./config/database");
const { app } = require("./config/app"); // берём готовый app из config/app.js

// Подключаем маршруты
const routes = require("./routes/index");
app.use("/", routes);

// Подключение к MongoDB при старте (важно для Vercel)
(async () => {
  const { isConnected } = await connectMongoDB();
  if (!isConnected) {
    console.error("❌ Нет подключения к MongoDB");
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
