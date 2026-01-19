const mongoose = require('mongoose');

const AlbaTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true }, // + earn/grant, - spend

    type: { type: String, enum: ['earn', 'spend', 'grant'], required: true, index: true },
    reason: {
      type: String,
      enum: ['referral_bonus', 'card_payment', 'admin_grant', 'manual_adjustment', 'upgrade_to_paid', 'card_entitlement_purchase'],
      required: true,
      index: true,
    },

    relatedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    relatedCodeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Code', default: null },
    relatedCardType: { type: String, enum: ['product', 'service', 'banner', null], default: null },
    relatedCardId: { type: mongoose.Schema.Types.ObjectId, default: null },

    comment: { type: String, default: '' }, // User-provided comment/note for the transaction
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AlbaTransaction', AlbaTransactionSchema);
