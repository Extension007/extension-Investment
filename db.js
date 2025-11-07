require("dotenv").config(); // Загружаем переменные окружения из .env
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs"); // ✅ используем bcryptjs для совместимости с сервером
const User = require("./models/User"); // Модель пользователя

async function initAdmin() {
  try {
    // Подключение к MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log("✅ MongoDB подключена");

    // Проверка: есть ли админ
    const adminExists = await User.findOne({ username: "admin" });

    if (!adminExists) {
      // Генерация хэша для пароля admin123
      const adminPass = bcrypt.hashSync("admin123", 10);
      console.log("🔑 Сгенерированный хэш:", adminPass);

      // Создание пользователя
      await User.create({
        username: "admin",
        password_hash: adminPass
      });

      console.log("👤 Пользователь admin создан");
    } else {
      console.log("ℹ️ Пользователь admin уже существует");
    }

    // Закрытие соединения
    await mongoose.connection.close();
    console.log("🔌 Соединение закрыто");
  } catch (err) {
    console.error("❌ Ошибка при создании администратора:", err);
  }
}

// Запуск напрямую: node db.js
if (require.main === module) {
  initAdmin();
}

module.exports = initAdmin;
