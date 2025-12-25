require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

async function createFounderAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB подключена\n");

    // Проверяем, существует ли уже пользователь "founder"
    const existingFounder = await User.findOne({ username: "founder" });
    if (existingFounder) {
      console.log("ℹ️  Админ-аккаунт 'founder' уже существует");
      console.log(`📋 Роль: ${existingFounder.role}`);
      console.log(`📋 Email: ${existingFounder.email}`);
      await mongoose.connection.close();
      return;
    }

    // Данные для создания founder админа
    const founderData = {
      username: "founder",
      email: "founder@exto.app", // Можно изменить на нужный email
      password_hash: await bcrypt.hash("FounderPass123!", 10), // Рекомендуется изменить пароль
      role: "admin"
    };

    // Создаем админ-аккаунт
    const founder = await User.create(founderData);
    console.log("✅ Админ-аккаунт создан:");
    console.log(`📋 Username: ${founder.username}`);
    console.log(`📋 Email: ${founder.email}`);
    console.log(`📋 Role: ${founder.role}`);
    console.log(`📋 ID: ${founder._id}`);
    console.log("\n⚠️  ОБЯЗАТЕЛЬНО измените пароль для аккаунта 'founder' после первого входа!");

    await mongoose.connection.close();
    console.log("\n🔌 Соединение закрыто");
  } catch (err) {
    console.error("❌ Ошибка создания founder админа:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  createFounderAdmin();
}

module.exports = createFounderAdmin;
