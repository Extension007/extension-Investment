const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  price: { type: Number, required: true },
  link: { type: String, trim: true },
  image_url: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model("Product", productSchema);
