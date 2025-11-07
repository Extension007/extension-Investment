require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/User");

async function initAdmin() {
  try {
    // Подключение к MongoDB (только если запускаешь db.js отдельно)
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log("✅ MongoDB подключена");

    // Проверка и создание администратора
    const adminExists = await User.findOne({ username: "admin" });
    if (!adminExists) {
      const adminPass = bcrypt.hashSync("admin123", 10);
      await User.create({ username: "admin", password_hash: adminPass });
      console.log("👤 Admin user created");
    } else {
      console.log("👤 Admin уже существует");
    }

    // Закрываем соединение после выполнения
    await mongoose.connection.close();
    console.log("🔌 Соединение закрыто");
  } catch (err) {
    console.error("❌ Ошибка инициализации администратора:", err);
  }
}

// Запуск только при прямом вызове
if (require.main === module) {
  initAdmin();
}

module.exports = initAdmin;
