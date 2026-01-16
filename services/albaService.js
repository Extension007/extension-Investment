const AlbaTransaction = require('../models/AlbaTransaction');

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

async function earnReferralBonus({ UserModel, referrerUserId, referredUserId, amount=10 }) {
  return addTx(UserModel, { userId: referrerUserId, amount, type:'earn', reason:'referral_bonus', relatedUserId: referredUserId });
}

async function spendAlba({ UserModel, userId, amount, reason, relatedCardType=null, relatedCardId=null, meta={} }) {
  if (amount <= 0) throw new Error('Amount must be positive');
  const cur = await UserModel.findById(userId).select('albaBalance').exec();
  if (Number(cur?.albaBalance || 0) < amount) return { ok:false, status:400, message:'Insufficient ALBA balance' };
  const user = await addTx(UserModel, { userId, amount: -amount, type:'spend', reason, relatedCardType, relatedCardId, meta });
  return { ok:true, user };
}

async function listTransactions({ userId, limit=100 }) {
  return AlbaTransaction.find({ userId }).sort({ createdAt:-1 }).limit(limit).exec();
}

module.exports = { grantAlba, earnReferralBonus, spendAlba, listTransactions };
