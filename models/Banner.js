const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  image_url: { type: String, required: true },
  link: { type: String, trim: true, default: "" },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  
  // Модерация (такая же логика как у товаров)
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },
  rejection_reason: { type: String, default: "" }
}, { timestamps: true });

module.exports = mongoose.model("Banner", bannerSchema);

