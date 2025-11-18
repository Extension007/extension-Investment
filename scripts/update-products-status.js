// Скрипт для обновления старых карточек: добавляет статус "approved" если его нет
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");

async function updateProductsStatus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ MongoDB подключена");

    // Находим все карточки без статуса или с null статусом
    const productsWithoutStatus = await Product.find({
      $or: [
        { status: { $exists: false } },
        { status: null }
      ]
    });

    console.log(`Найдено карточек без статуса: ${productsWithoutStatus.length}`);

    if (productsWithoutStatus.length > 0) {
      // Обновляем все карточки без статуса на "approved"
      const result = await Product.updateMany(
        {
          $or: [
            { status: { $exists: false } },
            { status: null }
          ]
        },
        { $set: { status: "approved" } }
      );

      console.log(`✅ Обновлено карточек: ${result.modifiedCount}`);
    } else {
      console.log("ℹ️  Все карточки уже имеют статус");
    }

    await mongoose.connection.close();
    console.log("🔌 Соединение закрыто");
  } catch (err) {
    console.error("❌ Ошибка:", err);
    process.exit(1);
  }
}

if (require.main === module) {
  updateProductsStatus();
}

module.exports = updateProductsStatus;

