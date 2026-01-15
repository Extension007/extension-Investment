const mongoose = require('mongoose');

const CodeUsageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    codeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Code', required: true, index: true },
    kind: { type: String, enum: ['slot', 'payment_activation'], required: true, index: true },
    type: { type: String, enum: ['product', 'service', 'banner'], required: true, index: true },

    ip: { type: String, default: null },
    userAgent: { type: String, default: null },

    cardId: { type: mongoose.Schema.Types.ObjectId, default: null },
    usedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true }
);

CodeUsageSchema.index({ userId: 1, codeId: 1 }, { unique: true });

module.exports = mongoose.model('CodeUsage', CodeUsageSchema);
