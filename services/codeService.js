const crypto = require('crypto');
const Code = require('../models/Code');
const CodeUsage = require('../models/CodeUsage');

function genCode(prefix = '') {
  return `${prefix}${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

async function createCodes({ count, kind, type, expiresAt = null, createdBy = null }) {
  const docs = [];
  for (let i = 0; i < count; i++) {
    docs.push({
      code: genCode(kind === 'payment_activation' ? 'ACT-' : 'SLOT-'),
      kind,
      type,
      expiresAt,
      createdBy
    });
  }
  return Code.insertMany(docs);
}

async function redeemSlotCode({ user, codeValue, ip, userAgent }) {
  const code = await Code.findOne({ code: codeValue }).exec();
  if (!code) return { ok: false, status: 404, message: 'Code not found' };

  if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
    if (code.status !== 'expired') { code.status = 'expired'; await code.save(); }
    return { ok: false, status: 400, message: 'Code expired' };
  }
  if (code.status !== 'active') return { ok: false, status: 400, message: `Code not active (${code.status})` };
  if (code.kind !== 'slot') return { ok: false, status: 400, message: 'Not a slot code' };

  const updated = await Code.findOneAndUpdate(
    { _id: code._id, status: 'active' },
    { $set: { status: 'used', usedBy: user._id, usedAt: new Date() } },
    { new: true }
  ).exec();
  if (!updated) return { ok: false, status: 409, message: 'Code already used' };

  await CodeUsage.create({
    userId: user._id,
    codeId: updated._id,
    kind: updated.kind,
    type: updated.type,
    ip,
    userAgent,
    usedAt: new Date()
  });

  if (!user.slots) user.slots = { total: 2, used: 0 };
  user.slots.total = Number(user.slots.total || 0) + 1;
  await user.save();

  return { ok: true, code: updated };
}

async function issuePaymentActivationCode({ userId, cardType, cardId, createdBy = null, expiresAt = null, meta = {} }) {
  return Code.create({
    code: genCode('ACT-'),
    kind: 'payment_activation',
    type: cardType,
    status: 'active',
    expiresAt,
    createdBy,
    reservedForUserId: userId,
    cardId,
    meta
  });
}

async function consumePaymentActivationCode({ userId, activationCode }) {
  const code = await Code.findOne({ code: activationCode }).exec();
  if (!code) return { ok: false, status: 404, message: 'Activation code not found' };

  if (code.expiresAt && code.expiresAt.getTime() <= Date.now()) {
    if (code.status !== 'expired') { code.status = 'expired'; await code.save(); }
    return { ok: false, status: 400, message: 'Activation code expired' };
  }

  if (code.kind !== 'payment_activation') return { ok: false, status: 400, message: 'Not an activation code' };
  if (code.status !== 'active') return { ok: false, status: 400, message: `Activation code not active (${code.status})` };
  if (String(code.reservedForUserId || '') !== String(userId)) return { ok: false, status: 403, message: 'Code not reserved for this user' };
  if (!code.cardId) return { ok: false, status: 400, message: 'Activation code has no card binding' };

  const updated = await Code.findOneAndUpdate(
    { _id: code._id, status: 'active' },
    { $set: { status: 'used', usedBy: userId, usedAt: new Date() } },
    { new: true }
  ).exec();
  if (!updated) return { ok: false, status: 409, message: 'Activation code already used' };

  await CodeUsage.create({
    userId,
    codeId: updated._id,
    kind: updated.kind,
    type: updated.type,
    cardId: updated.cardId,
    usedAt: new Date()
  });

  return { ok: true, code: updated };
}

module.exports = { createCodes, redeemSlotCode, issuePaymentActivationCode, consumePaymentActivationCode };
