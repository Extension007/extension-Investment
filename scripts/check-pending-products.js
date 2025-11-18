// Скрипт для проверки карточек на модерации
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const User = require("../models/User");

async function checkPendingProducts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB подключена\n");

    // Проверяем все карточки
    const allProducts = await Product.find().sort({ _id: -1 });
    console.log(`📦 Всего карточек в базе: ${allProducts.length}\n`);

    // Проверяем карточки по статусам
    const pending = await Product.find({ status: "pending" });
    const approved = await Product.find({ status: "approved" });
    const rejected = await Product.find({ status: "rejected" });
    const withoutStatus = await Product.find({ 
      $or: [
        { status: { $exists: false } },
        { status: null }
      ]
    });

    console.log(`⏳ На модерации (pending): ${pending.length}`);
    console.log(`✅ Одобренные (approved): ${approved.length}`);
    console.log(`❌ Отклоненные (rejected): ${rejected.length}`);
    console.log(`⚠️  Без статуса: ${withoutStatus.length}\n`);

    // Детальная информация о карточках на модерации
    if (pending.length > 0) {
      console.log("📋 Карточки на модерации:");
      for (const product of pending) {
        const ownerInfo = product.owner ? await User.findById(product.owner) : null;
        console.log(`  - ${product.name}`);
        console.log(`    ID: ${product._id}`);
        console.log(`    Статус: ${product.status}`);
        console.log(`    Владелец: ${ownerInfo ? ownerInfo.username : product.owner || "не указан"}`);
        console.log(`    Создано: ${product.createdAt}`);
        console.log("");
      }
    } else {
      console.log("ℹ️  Карточек на модерации не найдено\n");
    }

    // Проверяем карточки с owner но без статуса pending
    const withOwner = await Product.find({ 
      owner: { $ne: null },
      status: { $ne: "pending" }
    });
    if (withOwner.length > 0) {
      console.log(`⚠️  Найдено ${withOwner.length} карточек с владельцем, но не на модерации:`);
      withOwner.forEach(p => {
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
  checkPendingProducts();
}

module.exports = checkPendingProducts;

