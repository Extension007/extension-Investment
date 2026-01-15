const mongoose = require('mongoose');

const CodeSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ['slot', 'payment_activation'], required: true, index: true },
    type: { type: String, enum: ['product', 'service', 'banner'], required: true, index: true },

    status: { type: String, enum: ['active', 'used', 'expired'], default: 'active', index: true },
    expiresAt: { type: Date, default: null, index: true },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    usedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    usedAt: { type: Date, default: null },

    reservedForUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    cardId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },

    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Code', CodeSchema);
