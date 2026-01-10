const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true },
  password_hash: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  emailVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },
  verifiedAt: { type: Date },
  lastVerificationSent: { type: Date }
}, { timestamps: true });

// Методы
userSchema.methods.generateVerificationToken = function() {
  this.verificationToken = require('crypto').randomBytes(32).toString('hex');
  this.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа
  this.lastVerificationSent = new Date();
  return this.verificationToken;
};

userSchema.methods.verifyEmail = function() {
  this.emailVerified = true;
  this.verifiedAt = new Date();
  this.verificationToken = undefined;
  this.verificationTokenExpires = undefined;
  return this.save();
};

// Индексы уже созданы через unique: true в полях выше
// Дополнительные индексы не нужны, чтобы избежать дублирования

module.exports = mongoose.model("User", userSchema);
