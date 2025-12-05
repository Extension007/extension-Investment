const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" }
}, { timestamps: true });

// Индексы уже созданы через unique: true в полях выше
// Дополнительные индексы не нужны, чтобы избежать дублирования

module.exports = mongoose.model("User", userSchema);
