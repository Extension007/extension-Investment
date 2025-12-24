// Конфигурация запуска сервера
const { app } = require("./app");
const { connectMongoDB } = require("./database");

// Глобальный обработчик ошибок
const errorHandler = require("../middleware/errorHandler");
app.use(errorHandler);

function startServer(port = process.env.PORT || 3000, attemptsLeft = 5) {
  // Подключаемся к БД перед запуском сервера
  connectMongoDB().then(() => {
    const server = app
      .listen(port, "0.0.0.0", () => {
        console.log(`✅ Сервер запущен на http://localhost:${port}`);
      })
      .on("error", (err) => {
        if (err && err.code === "EADDRINUSE" && attemptsLeft > 0) {
          const nextPort = port + 1;
          console.warn(`⚠️  Порт ${port} занят, пробую ${nextPort}... (${attemptsLeft - 1} попыток осталось)`);
          startServer(nextPort, attemptsLeft - 1);
        } else {
          console.error("❌ Ошибка запуска сервера:", err);
          process.exit(1);
        }
      });

    return server;
  }).catch((err) => {
    console.error("❌ Ошибка подключения к БД:", err);
    console.warn("⚠️  Сервер запущен без БД");
    // Все равно запускаем сервер, но с ограниченным функционалом
    const server = app
      .listen(port, "0.0.0.0", () => {
        console.log(`✅ Сервер запущен на http://localhost:${port} (без БД)`);
      })
      .on("error", (err) => {
        if (err && err.code === "EADDRINUSE" && attemptsLeft > 0) {
          const nextPort = port + 1;
          console.warn(`⚠️  Порт ${port} занят, пробую ${nextPort}... (${attemptsLeft - 1} попыток осталось)`);
          startServer(nextPort, attemptsLeft - 1);
        } else {
          console.error("❌ Ошибка запуска сервера:", err);
          process.exit(1);
        }
      });

    return server;
  });
}

module.exports = {
  startServer
};
