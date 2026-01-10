const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  // Основные поля
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "", maxlength: 5000 },
  link: { type: String, trim: true, default: "" },
  video_url: { type: String, trim: true, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  category: { type: String, trim: true, default: "" }, // Категория (реклама, промо и т.д.)
  price: { type: String, default: "" },
  
  // Массив изображений (до 5 штук)
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
  
  // Обратная совместимость со старым полем image_url
  image_url: { type: String, default: null },
  
  // Статус: published / blocked / draft (адаптировано под существующую логику)
  status: {
    type: String,
    enum: ["published", "blocked", "draft", "pending", "approved", "rejected"],
    default: "published"
  },
  rejection_reason: { type: String, default: "" },
  
  // Рейтинг (голосование)
  rating_up: { type: Number, default: 0 }, // Голоса "за"
  rating_down: { type: Number, default: 0 }, // Голоса "против"
  voters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Пользователи, которые проголосовали
  rating_updated_at: { type: Date, default: Date.now }
}, { timestamps: true });

// Виртуальное поле для обратной совместимости: imageUrl -> image_url или первое изображение из массива
bannerSchema.virtual('imageUrl').get(function() {
  if (this.images && this.images.length > 0) {
    return this.images[0];
  }
  return this.image_url;
});

// Виртуальное поле: итоговый результат (rating_up − rating_down)
bannerSchema.virtual('result').get(function() {
  return (this.rating_up || 0) - (this.rating_down || 0);
});

// Виртуальное поле: общее количество голосов
bannerSchema.virtual('total').get(function() {
  return (this.rating_up || 0) + (this.rating_down || 0);
});

// При сохранении: синхронизация image_url с первым изображением из массива
bannerSchema.pre('save', function(next) {
  // Если есть изображения в массиве, используем первое для image_url
  if (this.images && this.images.length > 0 && !this.image_url) {
    this.image_url = this.images[0];
  }
  // Если есть image_url, но нет в массиве, добавляем
  if (this.image_url && (!this.images || this.images.length === 0)) {
    this.images = [this.image_url];
  }
  next();
});

// Включаем виртуальные поля в JSON
bannerSchema.set('toJSON', { virtuals: true });
bannerSchema.set('toObject', { virtuals: true });

// Индексы для оптимизации запросов
bannerSchema.index({ status: 1 });
bannerSchema.index({ owner: 1 });
bannerSchema.index({ category: 1 });
bannerSchema.index({ createdAt: -1 });
// Составной индекс для частых запросов
bannerSchema.index({ status: 1, category: 1 });

module.exports = mongoose.model("Banner", bannerSchema);
