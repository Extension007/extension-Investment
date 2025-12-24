// Конфигурация запуска сервера
const { app } = require("./app");
const { connectMongoDB, hasMongo } = require("./database");

// Глобальный обработчик ошибок
const errorHandler = require("../middleware/errorHandler");
app.use(errorHandler);

// Middleware для подключения к БД в serverless среде
if (process.env.VERCEL) {
  app.use(async (req, res, next) => {
    try {
      // В Vercel создаем новое соединение для каждого запроса
      const dbResult = await connectMongoDB();

      // Сохраняем соединение в req для использования в роутах
      if (dbResult && dbResult.isConnected) {
        req.dbConnection = dbResult.connection;
        req.dbConnected = true;
      } else {
        req.dbConnected = false;
      }

      next();
    } catch (err) {
      console.error("❌ Ошибка подключения к БД в middleware:", err);
      req.dbConnected = false;
      next(); // Продолжаем без БД
    }
  });
}

function startServer(port = process.env.PORT || 3000, attemptsLeft = 5) {
  // В Vercel serverless не нужно предварительное подключение
  if (process.env.VERCEL) {
    console.log("✅ Vercel serverless режим - подключение к БД будет создаваться для каждого запроса");
    return app;
  }

  // В обычной среде подключаемся к БД перед запуском сервера
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
