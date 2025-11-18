require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

async function fixProductsStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB подключена\n");

    // Найти все карточки без статуса или с null статусом
    const productsWithoutStatus = await Product.find({
      $or: [
        { status: { $exists: false } },
        { status: null },
        { status: "" }
      ]
    });
    
    console.log(`📋 Найдено карточек без статуса: ${productsWithoutStatus.length}\n`);

    if (productsWithoutStatus.length > 0) {
      for (const product of productsWithoutStatus) {
        // Если есть владелец - статус pending, иначе approved (старые карточки)
        const newStatus = product.owner ? "pending" : "approved";
        await Product.findByIdAndUpdate(product._id, { 
          status: newStatus,
          rejection_reason: ""
        });
        console.log(`✅ Обновлена карточка "${product.name}" (ID: ${product._id}): статус = ${newStatus}`);
      }
    }

    // Проверить карточки с владельцем и статусом pending
    const pendingProducts = await Product.find({ 
      owner: { $ne: null, $exists: true },
      status: "pending"
    });
    console.log(`\n⏳ Карточек на модерации: ${pendingProducts.length}`);
    pendingProducts.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p._id}, владелец: ${p.owner})`);
    });

    // Проверить все карточки
    const allProducts = await Product.find();
    console.log(`\n📦 Всего карточек: ${allProducts.length}`);
    const byStatus = {};
    allProducts.forEach(p => {
      const status = p.status || "не указан";
      byStatus[status] = (byStatus[status] || 0) + 1;
    });
    console.log("📊 Распределение по статусам:");
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  - ${status}: ${count}`);
    });

    await mongoose.connection.close();
    console.log("\n🔌 Соединение закрыто");
  } catch (err) {
    console.error("❌ Ошибка:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  fixProductsStatus();
}

