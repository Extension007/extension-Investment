// Скрипт для отладки создания карточек
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const User = require("../models/User");

async function debugProductCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB подключена\n");

    // Проверяем всех пользователей
    const users = await User.find();
    console.log(`👥 Пользователей в базе: ${users.length}`);
    users.forEach(u => {
      console.log(`  - ${u.username} (${u.role}) - ID: ${u._id}`);
    });
    console.log("");

    // Проверяем все карточки с деталями
    const allProducts = await Product.find().sort({ _id: -1 });
    console.log(`📦 Всего карточек: ${allProducts.length}\n`);

    if (allProducts.length > 0) {
      console.log("📋 Детали всех карточек:");
      for (const product of allProducts) {
        const ownerInfo = product.owner ? await User.findById(product.owner) : null;
        console.log(`  - ${product.name}`);
        console.log(`    ID: ${product._id}`);
        console.log(`    Статус: ${product.status || "не указан"}`);
        console.log(`    Владелец: ${ownerInfo ? `${ownerInfo.username} (${ownerInfo.role})` : product.owner || "не указан"}`);
        console.log(`    Цена: ${product.price}`);
        console.log(`    Создано: ${product.createdAt}`);
        console.log("");
      }
    }

    // Проверяем карточки с owner
    const withOwner = await Product.find({ owner: { $ne: null } });
    console.log(`\n📌 Карточек с владельцем: ${withOwner.length}`);
    if (withOwner.length > 0) {
      withOwner.forEach(p => {
        console.log(`  - ${p.name} (статус: ${p.status || "не указан"})`);
      });
    }

    // Проверяем карточки без owner
    const withoutOwner = await Product.find({ 
      $or: [
        { owner: null },
        { owner: { $exists: false } }
      ]
    });
    console.log(`\n📌 Карточек без владельца: ${withoutOwner.length}`);
    if (withoutOwner.length > 0) {
      withoutOwner.forEach(p => {
        console.log(`  - ${p.name} (статус: ${p.status || "не указан"})`);
      });
    }

    await mongoose.connection.close();
    console.log("\n🔌 Соединение закрыто");
  } catch (err) {
    console.error("❌ Ошибка:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  debugProductCreation();
}

module.exports = debugProductCreation;

