const { earnReferralBonus } = require('./albaService');
const AlbaTransaction = require('../models/AlbaTransaction');
const { v4: uuidv4 } = require('uuid');

// Get referral bonus amount from environment or use default
const REFERRAL_BONUS_ALBA = parseInt(process.env.REFERRAL_BONUS_ALBA) || 10;

async function grantReferralBonusIfEligible({ UserModel, user }) {
  if (user.emailVerified !== true) return;
  if (!user.referredBy) return;
  if (user.refBonusGranted === true) return;

  // Check if referral bonus was already granted (idempotent check)
  const existingTransaction = await AlbaTransaction.findOne({
    type: 'earn',
    reason: 'referral_bonus',
    relatedUserId: user._id
  });

  if (existingTransaction) {
    console.log(`Referral bonus already granted for user ${user._id}, skipping`);
    user.refBonusGranted = true;
    await user.save();
    return;
  }

  // Check for self-referral
  if (user.referredBy.toString() === user._id.toString()) {
    console.log(`Self-referral detected for user ${user._id}, skipping bonus`);
    return;
  }

  // Generate unique eventId for this referral
  const eventId = uuidv4();

  // Grant referral bonus
  await earnReferralBonus({
    UserModel,
    referrerUserId: user.referredBy,
    referredUserId: user._id,
    amount: REFERRAL_BONUS_ALBA
  });

  // Create transaction record with eventId
  await AlbaTransaction.create({
    userId: user.referredBy,
    amount: REFERRAL_BONUS_ALBA,
    type: 'earn',
    reason: 'referral_bonus',
    relatedUserId: user._id,
    meta: {
      eventId,
      referralType: 'one-time',
      referredUserId: user._id
    }
  });

  user.refBonusGranted = true;
  await user.save();
}

/**
 * Set referral binding (immutable)
 * @param {Object} params
 * @param {Object} params.UserModel - User model
 * @param {string} params.userId - User ID to set referral for
 * @param {string} params.referrerId - Referrer user ID
 * @returns {Promise<Object>} - Result with success status
 */
async function setReferralBinding({ UserModel, userId, referrerId }) {
  const user = await UserModel.findById(userId);
  if (!user) {
    return { ok: false, status: 404, message: 'User not found' };
  }

  // Check if referral is already set (immutable)
  if (user.referredBy) {
    return { ok: false, status: 400, message: 'Referral binding already set and cannot be changed' };
  }

  // Check for self-referral
  if (referrerId.toString() === userId.toString()) {
    return { ok: false, status: 400, message: 'Self-referral is not allowed' };
  }

  // Check if referrer exists
  const referrer = await UserModel.findById(referrerId);
  if (!referrer) {
    return { ok: false, status: 404, message: 'Referrer not found' };
  }

  // Set referral binding
  user.referredBy = referrerId;
  await user.save();

  return { ok: true, user };
}

/**
 * Get referral statistics for a user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Referral statistics
 */
async function getReferralStats(userId) {
  // Count successful referrals
  const successfulReferrals = await AlbaTransaction.countDocuments({
    userId,
    type: 'earn',
    reason: 'referral_bonus'
  });

  // Get total ALBA earned from referrals
  const referralTransactions = await AlbaTransaction.find({
    userId,
    type: 'earn',
    reason: 'referral_bonus'
  });

  const totalAlbaFromReferrals = referralTransactions.reduce((sum, tx) => sum + tx.amount, 0);

  return {
    successfulReferrals,
    totalAlbaFromReferrals,
    referralBonusAmount: REFERRAL_BONUS_ALBA
  };
}

module.exports = {
  grantReferralBonusIfEligible,
  setReferralBinding,
  getReferralStats,
  REFERRAL_BONUS_ALBA
};
