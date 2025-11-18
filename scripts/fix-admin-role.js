require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");

async function fixAdminRole() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB подключена\n");

    // Найти пользователя "admin"
    const adminUser = await User.findOne({ username: "admin" });
    if (!adminUser) {
      console.log("❌ Пользователь 'admin' не найден");
      await mongoose.connection.close();
      return;
    }

    console.log(`📋 Текущая роль пользователя 'admin': ${adminUser.role}`);
    console.log(`📋 ID пользователя: ${adminUser._id}\n`);

    if (adminUser.role !== "admin") {
      // Обновляем только роль, не трогая другие поля
      await User.findByIdAndUpdate(adminUser._id, { role: "admin" }, { runValidators: false });
      console.log("✅ Роль пользователя 'admin' изменена на 'admin'\n");
    } else {
      console.log("ℹ️  Пользователь 'admin' уже имеет роль 'admin'\n");
    }

    // Показать всех пользователей
    const allUsers = await User.find();
    console.log("👥 Все пользователи в базе:");
    allUsers.forEach(u => {
      console.log(`  - ${u.username} (${u.role}) - ID: ${u._id}`);
    });

    await mongoose.connection.close();
    console.log("\n🔌 Соединение закрыто");
  } catch (err) {
    console.error("❌ Ошибка:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  fixAdminRole();
}

