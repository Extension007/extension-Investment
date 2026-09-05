const { Op } = require("sequelize");
const Product = require("../models/Product");
const Entitlement = require("../models/Entitlement");
const User = require("../models/User");
const { sequelize } = require("../config/database");
const { consumeEntitlement, purchaseEntitlement } = require("./albaService");
const { notDeletedClause } = require("../utils/catalogFilters");
const { httpError } = require("../utils/httpError");
const logger = require("../utils/logger");
const {
  isExpired,
  PUBLICATION_EXPIRED_REASON,
  republicationResetFields,
  shouldAttemptAutoRenew,
  autoRenewExtensionFields,
  autoRenewIdempotencyKey
} = require("../utils/cardPublication");

async function consumeOrPurchasePublicationRight({ userId, cardType, cardId, idempotencyKey, transaction, meta = {} }) {
  // Auto-renew bills ALBA only. Prepaid create/republish entitlements stay unused.
  const existingByKey = await Entitlement.findOne({
    where: { idempotencyKey, ownerId: userId, type: cardType },
    lock: transaction.LOCK.UPDATE,
    transaction
  });
  if (existingByKey) {
    if (existingByKey.status === "consumed") {
      return { ok: true, entitlement: existingByKey, alreadyConsumed: true };
    }
    return consumeEntitlement(existingByKey.id, { transaction });
  }

  const purchased = await purchaseEntitlement({
    UserModel: User,
    userId,
    type: cardType,
    idempotencyKey,
    relatedCardId: cardId,
    transaction,
    meta
  });
  if (!purchased.ok) return purchased;
  if (purchased.entitlement && purchased.entitlement.status === "consumed") {
    return { ok: true, entitlement: purchased.entitlement, alreadyConsumed: true };
  }
  return consumeEntitlement(purchased.entitlement.id, { transaction });
}

async function autoRenewExpiredCard({ productId, now = new Date() }) {
  try {
    return await sequelize.transaction(async (t) => {
      const product = await Product.findByPk(productId, {
        transaction: t,
        lock: t.LOCK.UPDATE
      });
      if (!shouldAttemptAutoRenew(product, now)) {
        return { ok: false, code: "NOT_ELIGIBLE" };
      }

      const cardType = product.type === "service" ? "service" : "product";
      const right = await consumeOrPurchasePublicationRight({
        userId: product.ownerId,
        cardType,
        cardId: product.id,
        idempotencyKey: autoRenewIdempotencyKey(product),
        transaction: t,
        meta: { source: "auto_renew", cardId: product.id }
      });
      if (!right.ok) {
        return {
          ok: false,
          code: right.status === 400 ? "NO_ALBA" : "NO_ENTITLEMENT",
          message: right.message
        };
      }

      const fields = autoRenewExtensionFields(now);
      await product.update(fields, { transaction: t });
      return { ok: true, product, expiresAt: fields.expiresAt };
    });
  } catch (err) {
    logger.warn({
      msg: "auto_renew_failed",
      productId,
      error: err.message
    });
    return { ok: false, code: "ERROR", message: err.message };
  }
}

async function expirePublishedCards({ ownerId } = {}) {
  const now = new Date();
  const dueWhere = {
    status: "approved",
    expiresAt: { [Op.lte]: now },
    [Op.and]: [notDeletedClause()]
  };
  if (ownerId) dueWhere.ownerId = ownerId;

  const due = await Product.findAll({ where: dueWhere });
  let renewed = 0;
  const expireIds = [];

  for (const card of due) {
    if (card.autoRenew) {
      const result = await autoRenewExpiredCard({ productId: card.id, now });
      if (result.ok) {
        renewed += 1;
        continue;
      }
      logger.info({
        msg: "auto_renew_skipped",
        productId: card.id,
        reason: result.code || result.message
      });
    }
    expireIds.push(card.id);
  }

  let expired = 0;
  if (expireIds.length) {
    const [count] = await Product.update(
      {
        status: "rejected",
        rejectionReason: PUBLICATION_EXPIRED_REASON
      },
      {
        where: {
          id: { [Op.in]: expireIds },
          status: "approved"
        }
      }
    );
    expired = count;
  }

  const retryWhere = {
    status: "rejected",
    rejectionReason: PUBLICATION_EXPIRED_REASON,
    autoRenew: true,
    [Op.and]: [notDeletedClause()]
  };
  if (ownerId) retryWhere.ownerId = ownerId;
  const retryCards = await Product.findAll({ where: retryWhere });
  for (const card of retryCards) {
    const result = await autoRenewExpiredCard({ productId: card.id, now });
    if (result.ok) renewed += 1;
  }

  return { expired, renewed };
}

async function setCardAutoRenew({ productId, userId, enabled }) {
  const product = await Product.findOne({
    where: { id: productId, ownerId: userId, deleted: false }
  });
  if (!product) {
    throw httpError(404, "Карточка не найдена", "NOT_FOUND");
  }

  const autoRenew = Boolean(enabled);
  await product.update({ autoRenew });

  let renewed = false;
  if (autoRenew && shouldAttemptAutoRenew({ ...product.toJSON(), autoRenew: true }, new Date())) {
    const result = await autoRenewExpiredCard({ productId: product.id });
    renewed = Boolean(result.ok);
  }

  return { autoRenew, renewed };
}

async function republishCard({ productId, userId, type }) {
  const product = await Product.findOne({
    where: { id: productId, ownerId: userId, deleted: false }
  });
  if (!product) {
    throw httpError(404, "Карточка не найдена", "NOT_FOUND");
  }
  if (type && product.type && product.type !== type && !(type === "product" && !product.type)) {
    throw httpError(403, "Нельзя продлить карточку этого типа", "WRONG_TYPE");
  }
  if (!isExpired(product) && product.status === "approved") {
    throw httpError(400, "Карточка ещё опубликована. Продление нужно после окончания срока.", "STILL_LIVE");
  }

  return sequelize.transaction(async (t) => {
    const cardType = product.type === "service" ? "service" : "product";
    const entitlement = await Entitlement.findOne({
      where: {
        ownerId: userId,
        type: cardType,
        status: "available"
      },
      order: [["createdAt", "ASC"]],
      lock: t.LOCK.UPDATE,
      transaction: t
    });
    if (!entitlement) {
      throw httpError(403, "Нет доступных прав. Купите право в балансе ALBA.", "NO_ENTITLEMENT");
    }
    const consumeResult = await consumeEntitlement(entitlement.id, { transaction: t });
    if (!consumeResult.ok) {
      throw httpError(403, consumeResult.message || "Не удалось списать право", "NO_ENTITLEMENT");
    }

    await product.update(republicationResetFields(), { transaction: t });
    return { product, entitlementId: entitlement.id };
  });
}

module.exports = {
  expirePublishedCards,
  republishCard,
  setCardAutoRenew,
  autoRenewExpiredCard
};
