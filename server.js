// Главный файл приложения
require("dotenv").config();
const express = require("express"); // важно для Vercel
const { connectMongoDB } = require("./config/database");
const { app } = require("./config/app"); // берём готовый app из config/app.js
const routes = require("./routes/index");
const http = require("http");
const { Server } = require("socket.io");

// Создаём HTTP сервер
const server = http.createServer(app);

// Инициализируем Socket.IO сервер только если не на Vercel
let io;
if (!process.env.VERCEL) {
  io = new Server(server, {
    cors: {
      origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || '' : '*', // В продакшене нужно указать конкретные домены
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Подключаем маршруты с Socket.IO
  require("./routes/comments").setSocketIO(io); // Передаем io в комментарии до подключения маршрутов
  app.use("/", routes);

  // Подключаем обработчики WebSocket событий
  require("./socket/commentChat")(io);
} else {
  // На Vercel подключаем маршруты без Socket.IO
  app.use("/", routes);
}

// Экспорт приложения для Vercel
module.exports = app;

// Локальный запуск
if (require.main === module) {
  (async () => {
    try {
      // Подключение к MongoDB при старте
      const { isConnected } = await connectMongoDB();
      if (!isConnected) {
        console.error("❌ Нет подключения к MongoDB");
      } else {
        console.log("✅ MongoDB подключена");
      }

      const PORT = process.env.PORT || 3000;
      server.listen(PORT, () => {
        console.log(`Сервер запущен на http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error("❌ Ошибка подключения к MongoDB:", err);

      // Запускаем сервер даже при ошибке подключения
      const PORT = process.env.PORT || 3000;
      server.listen(PORT, () => {
        console.log(`Сервер запущен на http://localhost:${PORT} (без MongoDB)`);
      });
    }
  })();
}
