const mongoose = require('mongoose');
const AlbaTransaction = require('../models/AlbaTransaction');
const Entitlement = require('../models/Entitlement');
const { randomUUID } = require('crypto');

async function incBalance(UserModel, userId, delta) {
  return UserModel.findOneAndUpdate({ _id: userId }, { $inc: { albaBalance: delta } }, { new: true }).exec();
}

async function addTx(UserModel, { userId, amount, type, reason, relatedUserId=null, relatedCodeId=null, relatedCardType=null, relatedCardId=null, meta={} }) {
  const user = await incBalance(UserModel, userId, amount);
  await AlbaTransaction.create({ userId, amount, type, reason, relatedUserId, relatedCodeId, relatedCardType, relatedCardId, meta });
  return user;
}

async function grantAlba({ UserModel, userId, amount, reason, actorAdminId=null, meta={} }) {
  if (amount <= 0) throw new Error('Amount must be positive');
  return addTx(UserModel, { userId, amount, type: 'grant', reason, relatedUserId: actorAdminId, meta });
}

async function grantAlbaByUsername(login, amount, reason, adminId = null, comment = '') {
  const User = require('../models/User');
  const user = await User.findOne({ username: login });
  if (!user) throw new Error("User not found");
  if (!user.emailVerified) throw new Error("Email not verified");

  const AlbaTransaction = require('../models/AlbaTransaction');
  const AuditLog = require('../models/AuditLog');

  const tx = await AlbaTransaction.create({
    userId: user._id,
    amount,
    reason,
    type: 'grant',
    comment: comment,
    createdAt: new Date()
  });

  await User.updateOne(
    { _id: user._id },
    { $inc: { albaBalance: amount } }
  );

  // Create audit log entry
  await AuditLog.create({
    action: 'alba_grant',
    userId: user._id,
    targetUserId: user._id,
    adminId: adminId,
    amount: amount,
    reason: reason,
    comment: comment,
    details: {
      originalBalance: user.albaBalance,
      newBalance: user.albaBalance + amount,
      login: login
    }
  });

  return { user, tx };
}

async function earnReferralBonus({ UserModel, referrerUserId, referredUserId, amount=10 }) {
  return addTx(UserModel, { userId: referrerUserId, amount, type:'earn', reason:'referral_bonus', relatedUserId: referredUserId });
}

async function spendAlba({ UserModel, userId, amount, reason, relatedCardType=null, relatedCardId=null, meta={} }) {
  if (amount <= 0) throw new Error('Amount must be positive');

  // ALLOWLIST: Only specific reasons are permitted for user spend operations
  const allowedUserReasons = ['card_entitlement_purchase'];
  const allowedAdminReasons = ['admin_grant', 'manual_adjustment'];

  // Check if reason is allowed
  if (!allowedUserReasons.includes(reason) && !allowedAdminReasons.includes(reason)) {
    return { ok: false, status: 403, message: `Reason '${reason}' is not allowed for ALBA spend operations` };
  }

  const cur = await UserModel.findById(userId).select('albaBalance').exec();
  if (Number(cur?.albaBalance || 0) < amount) return { ok:false, status:400, message:'Insufficient ALBA balance' };
  const user = await addTx(UserModel, { userId, amount: -amount, type:'spend', reason, relatedCardType, relatedCardId, meta });
  return { ok:true, user };
}

async function listTransactions({ userId, limit=100 }) {
  return AlbaTransaction.find({ userId }).sort({ createdAt:-1 }).limit(limit).exec();
}

/**
 * Purchase an entitlement for creating additional cards
 * @param {Object} params
 * @param {Object} params.UserModel - User model
 * @param {string} params.userId - User ID
 * @param {string} params.type - Entitlement type ('product' or 'service')
 * @param {string} params.idempotencyKey - Idempotency key to prevent duplicate purchases
 * @returns {Promise<Object>} - Result with success status and entitlement
 */
async function purchaseEntitlement({ UserModel, userId, type, idempotencyKey }) {
  // Validate type
  if (!['product', 'service'].includes(type)) {
    return { ok: false, status: 400, message: 'Invalid entitlement type. Must be "product" or "service"' };
  }

  // Check for existing entitlement with same idempotencyKey
  const existingEntitlement = await Entitlement.findOne({
    idempotencyKey,
    owner: userId,
    type
  });

  if (existingEntitlement) {
    // If entitlement already exists, return it without charging again
    return { ok: true, entitlement: existingEntitlement, message: 'Entitlement already purchased (idempotent)' };
  }

  // Check if user has sufficient ALBA balance
  const user = await UserModel.findById(userId).select('albaBalance').exec();
  if (!user) {
    return { ok: false, status: 404, message: 'User not found' };
  }

  const requiredAmount = 30;
  if (Number(user.albaBalance || 0) < requiredAmount) {
    return { ok: false, status: 400, message: 'Insufficient ALBA balance' };
  }

  // Generate unique eventId
  const eventId = randomUUID();

  // Start transaction for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Spend ALBA
    const spendResult = await spendAlba({
      UserModel,
      userId,
      amount: requiredAmount,
      reason: 'card_entitlement_purchase',
      relatedCardType: type,
      meta: { eventId, idempotencyKey }
    });

    if (!spendResult.ok) {
      await session.abortTransaction();
      return spendResult;
    }

    // Create entitlement
    const entitlement = await Entitlement.create([{
      owner: userId,
      type,
      status: 'available',
      source: 'purchase',
      idempotencyKey,
      eventId,
      relatedTransactionId: spendResult.user._id
    }], { session });

    // Create ALBA transaction record
    const transaction = await AlbaTransaction.create([{
      userId,
      amount: -requiredAmount,
      type: 'spend',
      reason: 'card_entitlement_purchase',
      relatedCardType: type,
      relatedCardId: null,
      meta: {
        eventId,
        idempotencyKey,
        entitlementId: entitlement[0]._id
      }
    }], { session });

    await session.commitTransaction();
    return { ok: true, entitlement: entitlement[0], transaction: transaction[0] };
  } catch (error) {
    await session.abortTransaction();
    console.error('Error purchasing entitlement:', error);
    return { ok: false, status: 500, message: 'Error purchasing entitlement: ' + error.message };
  } finally {
    session.endSession();
  }
}

/**
 * Get available entitlements count for a user by type
 * @param {string} userId - User ID
 * @param {string} type - Entitlement type ('product' or 'service')
 * @returns {Promise<number>} - Count of available entitlements
 */
async function getAvailableEntitlementsCount(userId, type) {
  return Entitlement.countDocuments({
    owner: userId,
    type,
    status: 'available'
  });
}

/**
 * Get all available entitlements for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of available entitlements
 */
async function getAvailableEntitlements(userId) {
  return Entitlement.find({
    owner: userId,
    status: 'available'
  }).exec();
}

/**
 * Consume an entitlement (mark as used)
 * @param {string} entitlementId - Entitlement ID
 * @returns {Promise<Object>} - Result with success status
 */
async function consumeEntitlement(entitlementId) {
  const entitlement = await Entitlement.findById(entitlementId);
  if (!entitlement) {
    return { ok: false, status: 404, message: 'Entitlement not found' };
  }

  if (entitlement.status !== 'available') {
    return { ok: false, status: 400, message: 'Entitlement already consumed' };
  }

  entitlement.status = 'consumed';
  await entitlement.save();
  return { ok: true, entitlement };
}

module.exports = {
  grantAlba,
  earnReferralBonus,
  spendAlba,
  listTransactions,
  purchaseEntitlement,
  getAvailableEntitlementsCount,
  getAvailableEntitlements,
  consumeEntitlement,
  grantAlbaByUsername
};
