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
  lastVerificationSent: { type: Date },

  // P1: Slots system (1+1 contract = 2 total slots)
  slots: {
    total: { type: Number, default: 2 },
    used: { type: Number, default: 0 }
  },

  // P1: Alba balance
  albaBalance: { type: Number, default: 0 },

  // P1: Referral system
  refCode: { type: String, unique: true, index: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  refBonusGranted: { type: Boolean, default: false }
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

// P1: Generate referral code if not present
userSchema.methods.generateRefCode = async function() {
  if (this.refCode) return this.refCode;

  const crypto = require('crypto');
  const User = mongoose.model('User');

  // Try up to 5 times to generate a unique short code
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = crypto.randomBytes(5).toString('hex').toUpperCase().slice(0, 8);
    const existing = await User.findOne({ refCode: code });
    if (!existing) {
      this.refCode = code;
      return code;
    }
  }

  // Fallback: generate longer code if short code generation fails
  this.refCode = crypto.randomBytes(10).toString('hex').toUpperCase();
  return this.refCode;
};

// P1: Pre-save hook to generate refCode if not present
userSchema.pre('save', async function(next) {
  if (!this.refCode) {
    await this.generateRefCode();
  }
  next();
});

// Индексы уже созданы через unique: true в полях выше
// Дополнительные индексы не нужны, чтобы избежать дублирования

module.exports = mongoose.model("User", userSchema);
