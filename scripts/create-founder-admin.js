// Скрипт для создания администратора founder
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");

async function createFounderAdmin() {
  try {
    // Подключаемся к MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      console.error("❌ MONGODB_URI не задан");
      process.exit(1);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ Подключились к MongoDB");

    // Проверяем, существует ли уже пользователь с таким email
    const existingUser = await User.findOne({ email: "x77771227722@gmail.com" });
    if (existingUser) {
      console.log("✅ Администратор founder уже существует");
      console.log("Данные для входа:");
      console.log("Email:", existingUser.email);
      console.log("Username:", existingUser.username);
      console.log("Role:", existingUser.role);
      return;
    }

    // Создаем хэш пароля
    const password = "founder123";
    const passwordHash = await bcrypt.hash(password, 10);

    // Создаем пользователя
    const user = new User({
      username: "founder",
      email: "x77771227722@gmail.com",
      password_hash: passwordHash,
      role: "admin"
    });

    await user.save();
    console.log("✅ Администратор founder создан");
    console.log("Данные для входа:");
    console.log("Email:", user.email);
    console.log("Username:", user.username);
    console.log("Role:", user.role);
    console.log("Password: founder123");
  } catch (err) {
    console.error("❌ Ошибка создания администратора:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

createFounderAdmin();
