const mongoose = require('mongoose');

const entitlementSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['product', 'service'],
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['available', 'consumed'],
    default: 'available',
    index: true
  },
  source: {
    type: String,
    enum: ['purchase', 'referral_migration', 'admin_migration', 'legacy_migration'],
    default: 'purchase',
    index: true
  },
  idempotencyKey: {
    type: String,
    index: true,
    sparse: true
  },
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  relatedTransactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AlbaTransaction',
    index: true
  }
}, { timestamps: true });

// Compound index for fast lookup of available entitlements by owner and type
entitlementSchema.index({ owner: 1, type: 1, status: 1 });

// Compound index to prevent duplicates by owner, type, and idempotencyKey
entitlementSchema.index({ owner: 1, type: 1, idempotencyKey: 1 }, { unique: true });

module.exports = mongoose.model('Entitlement', entitlementSchema);
