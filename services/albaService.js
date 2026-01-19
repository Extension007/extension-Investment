const mongoose = require('mongoose');
const AlbaTransaction = require('../models/AlbaTransaction');
const Entitlement = require('../models/Entitlement');
const { randomUUID } = require('crypto');

/**
 * Calculate user's ALBA balance as sum of all transactions
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Calculated balance
 */
async function getUserAlbaBalance(userId) {
  const result = await AlbaTransaction.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$amount" } } }
  ]);
  
  return result.length > 0 ? result[0].total : 0;
}

async function incBalance(UserModel, userId, delta) {
  return UserModel.findOneAndUpdate({ _id: userId }, { $inc: { albaBalance: delta } }, { new: true }).exec();
}

async function addTx(UserModel, { userId, amount, type, reason, relatedUserId=null, relatedCodeId=null, relatedCardType=null, relatedCardId=null, meta={} }) {
  // Check if the operation would result in negative balance
  if (amount < 0) {
    const currentBalance = await getUserAlbaBalance(userId);
    if (currentBalance + amount < 0) {
      throw new Error('Transaction would result in negative balance');
    }
  }
  
  // Update both the calculated balance field and create transaction
  const user = await incBalance(UserModel, userId, amount);
  const transaction = await AlbaTransaction.create({ userId, amount, type, reason, relatedUserId, relatedCodeId, relatedCardType, relatedCardId, meta });
  return { user, transaction };
}

async function grantAlba({ UserModel, userId, amount, reason, actorAdminId=null, meta={} }) {
  if (amount <= 0) throw new Error('Amount must be positive');
  const result = await addTx(UserModel, { userId, amount, type: 'grant', reason, relatedUserId: actorAdminId, meta });
  return result.user; // Return user object to maintain compatibility
}

async function grantAlbaByUsername(login, amount, reason, adminId = null, comment = '') {
  const User = require('../models/User');
  const user = await User.findOne({ username: login });
  if (!user) throw new Error("User not found");
  if (!user.emailVerified) throw new Error("Email not verified");

  const AuditLog = require('../models/AuditLog');

  try {
    // Use addTx to ensure consistency between balance and transactions
    const result = await addTx(User, {
      userId: user._id,
      amount,
      type: 'grant',
      reason,
      relatedUserId: adminId,
      comment,
      meta: { source: 'admin_grant_by_username' }
    });

    // Get actual balance using our new function
    const originalBalance = await getUserAlbaBalance(user._id);
    const newBalance = originalBalance + amount;
    
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
        originalBalance: originalBalance,
        newBalance: newBalance,
        login: login
      }
    });

    return { user, tx: result.transaction };
  } catch (error) {
    if (error.message === 'Transaction would result in negative balance') {
      throw new Error('Grant operation would result in negative balance');
    }
    throw error;
  }
}

async function earnReferralBonus({ UserModel, referrerUserId, referredUserId, amount=30 }) {
  const result = await addTx(UserModel, { userId: referrerUserId, amount, type:'earn', reason:'referral_bonus', relatedUserId: referredUserId });
  return result.user; // Return user object to maintain compatibility
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

  const currentBalance = await getUserAlbaBalance(userId);
  if (currentBalance < amount) return { ok:false, status:400, message:`Insufficient ALBA balance. Required: ${amount}, available: ${currentBalance}` };
  
  try {
    // Create transaction
    const result = await addTx(UserModel, { userId, amount: -amount, type:'spend', reason, relatedCardType, relatedCardId, meta });
    
    return { ok: true, user: result.user, transaction: result.transaction };
  } catch (error) {
    if (error.message === 'Transaction would result in negative balance') {
      return { ok: false, status: 400, message: `Insufficient ALBA balance. Required: ${amount}, available: ${currentBalance}` };
    }
    throw error;
  }
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
  const user = await UserModel.findById(userId).exec();
  if (!user) {
    return { ok: false, status: 404, message: 'User not found' };
  }

  const requiredAmount = 30;
  const currentBalance = await getUserAlbaBalance(userId);
  if (currentBalance < requiredAmount) {
    return { ok: false, status: 400, message: `Insufficient ALBA balance. Required: ${requiredAmount}, available: ${currentBalance}` };
  }

  // Generate unique eventId
  const eventId = randomUUID();

  // Start transaction for atomicity
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Spend ALBA - this will create the transaction
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

    await session.commitTransaction();
    
    // Return the transaction created by spendAlba function
    return { ok: true, entitlement: entitlement[0], transaction: spendResult.transaction };  // spendResult.transaction contains the actual transaction record
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
  grantAlbaByUsername,
  getUserAlbaBalance
};
