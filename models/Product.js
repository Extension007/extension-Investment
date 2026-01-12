const mongoose = require("mongoose");

// FIX: Схема контактов продавца
const contactsSchema = new mongoose.Schema({
  phone: { 
    type: String, 
    trim: true, 
    default: "",
    validate: {
      validator: function(v) {
        if (!v) return true; // Пустое значение допустимо
        // Простая валидация телефона (цифры, +, -, пробелы, скобки)
        return /^[\d\s\+\-\(\)]+$/.test(v);
      },
      message: 'Некорректный формат телефона'
    }
  },
  email: { 
    type: String, 
    trim: true, 
    default: "",
    lowercase: true,
    validate: {
      validator: function(v) {
        if (!v) return true; // Пустое значение допустимо
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Некорректный формат email'
    }
  },
  telegram: { type: String, trim: true, default: "" },
  whatsapp: { type: String, trim: true, default: "" },
  contact_method: { type: String, trim: true, default: "" } // FIX: Способ связи
}, { _id: false });

const productSchema = new mongoose.Schema({
  // FIX: Основные поля товара
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "", maxlength: 5000 },
  price: { type: String, required: true },
  link: { type: String, trim: true },
  
  // FIX: Массив изображений (до 5 штук)
  images: { 
    type: [String], 
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 5;
      },
      message: 'Максимальное количество изображений: 5'
    }
  },
  
  // FIX: Обратная совместимость со старым полем image_url
  image_url: { type: String, default: null },
  video_url: { type: String, trim: true, default: "" },
  
  // FIX: Контакты продавца
  contacts: { type: contactsSchema, default: () => ({}) },
  
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  // Обратная совместимость - старое поле category
  category: {
    type: String,
    default: "",
    maxlength: 200
  },
  
  // Тип публикации: товар или услуга
  type: {
    type: String,
    enum: ["product", "service"],
    default: "product"
  },

  // 🔹 Рейтинг
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  rating_updated_at: { type: Date, default: Date.now },
  
  // 🔹 Модерация
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  rejection_reason: { type: String, default: "", maxlength: 1000 },
  
  // Soft delete
  deleted: { type: Boolean, default: false }
}, { timestamps: true });

// FIX: Предварительная валидация перед сохранением - проверка лимита изображений
productSchema.pre('save', function(next) {
  if (this.images && this.images.length > 5) {
    return next(new Error('Максимальное количество изображений: 5'));
  }
  next();
});

// 🔹 Виртуальное поле: итоговый результат (лайки − дизлайки)
productSchema.virtual("result").get(function () {
  return (this.likes || 0) - (this.dislikes || 0);
});

// 🔹 Виртуальное поле: общее количество голосов
productSchema.virtual("total").get(function () {
  return (this.likes || 0) + (this.dislikes || 0);
});

// Включаем виртуальные поля при преобразовании в JSON/объект
productSchema.set("toJSON", { virtuals: true });
productSchema.set("toObject", { virtuals: true });

// Индексы для оптимизации запросов
productSchema.index({ status: 1 });
productSchema.index({ owner: 1 });
productSchema.index({ category: 1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ deleted: 1 });
productSchema.index({ type: 1 });
// Составной индекс для частых запросов
productSchema.index({ status: 1, type: 1 });
productSchema.index({ status: 1, category: 1 });
productSchema.index({ status: 1, deleted: 1 });
productSchema.index({ category: 1, status: 1, createdAt: -1 }); // Для фильтрации по категориям
productSchema.index({ result: -1 }); // Для сортировки по рейтингу

// Hook для удаления изображений при удалении карточки (soft delete или полное удаление)
productSchema.pre(['findOneAndDelete', 'findOneAndUpdate'], async function() {
  try {
    // Проверяем, это операция удаления (soft delete через deleted: true)
    const update = this.getUpdate();
    if (update && update.$set && update.$set.deleted === true) {
      // Это soft delete - получаем документ
      const product = await this.model.findOne(this.getQuery());
      if (product && product.images && product.images.length > 0) {
        console.log(`🗑️  Soft delete карточки ${product._id}, удаляем ${product.images.length} изображений`);
        const { deleteProductImages } = require("../services/imageService");
        await deleteProductImages(product.images);
      }
    } else if (this.op === 'findOneAndDelete') {
      // Это полное удаление
      const product = await this.model.findOne(this.getQuery());
      if (product && product.images && product.images.length > 0) {
        console.log(`🗑️  Полное удаление карточки ${product._id}, удаляем ${product.images.length} изображений`);
        const { deleteProductImages } = require("../services/imageService");
        await deleteProductImages(product.images);
      }
    }
  } catch (err) {
    console.error("❌ Ошибка в pre-hook удаления изображений:", err);
    // Не прерываем удаление, даже если не удалось удалить изображения
  }
});

// Статические методы для оптимизации запросов
productSchema.statics.getApprovedProducts = function(category = null, limit = 50) {
  const filter = {
    status: "approved",
    deleted: { $ne: true },
    $or: [
      { type: "product" },
      { type: { $exists: false } },
      { type: null }
    ]
  };

  if (category) {
    filter.category = category;
  }

  return this.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

productSchema.statics.getApprovedServices = function(category = null, limit = 50) {
  const filter = {
    status: "approved",
    deleted: { $ne: true },
    type: "service"
  };

  if (category) {
    filter.category = category;
  }

  return this.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

productSchema.statics.getPopularProducts = function(limit = 10) {
  return this.find({
    status: "approved",
    deleted: { $ne: true },
    $or: [
      { type: "product" },
      { type: { $exists: false } },
      { type: null }
    ]
  })
    .sort({ result: -1, createdAt: -1 })
    .limit(limit)
    .lean();
};

module.exports = mongoose.model("Product", productSchema);
