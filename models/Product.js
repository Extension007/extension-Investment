const mongoose = require("../db");

// Определяем схему товара
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true // название обязательно
  },
  description: { 
    type: String 
  },
  price: { 
    type: Number, 
    required: true // цена обязательна
  },
  link: { 
    type: String // ссылка на товар или магазин
  },
  image_path: { 
    type: String // путь или URL изображения
  }
}, { 
  timestamps: true // автоматически добавляет createdAt и updatedAt
});

// Создаём модель на основе схемы
module.exports = mongoose.model("Product", productSchema);
