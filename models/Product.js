const mongoose = require("mongoose");

// FIX: Схема контактов продавца
const contactsSchema = new mongoose.Schema({
  phone: { type: String, trim: true, default: "" },
  email: { type: String, trim: true, default: "" },
  telegram: { type: String, trim: true, default: "" },
  whatsapp: { type: String, trim: true, default: "" },
  contact_method: { type: String, trim: true, default: "" } // FIX: Способ связи
}, { _id: false });

const productSchema = new mongoose.Schema({
  // FIX: Основные поля товара
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  price: { type: Number, required: true },
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
  category: {
    type: String,
    enum: ["home", "beauty", "auto", "electric", "electronics", "plumbing"],
    default: "home"
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
  rejection_reason: { type: String, default: "" }
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

module.exports = mongoose.model("Product", productSchema);
