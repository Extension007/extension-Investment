const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  price: { type: Number, required: true },
  link: { type: String, trim: true },
  image_url: { type: String, default: null },
  video_url: { type: String, trim: true, default: "" },
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
