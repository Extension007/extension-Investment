const { Op } = require("sequelize");
const { httpError } = require("./httpError");

const FREE_LIFETIME_DAYS = 7;
const PAID_LIFETIME_MONTHS = 1;
const EDIT_WINDOW_HOURS = 24;
const PUBLICATION_EXPIRED_REASON = "publication_expired";

function asDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function addCalendarMonths(date, months) {
  const source = new Date(date.getTime());
  const day = source.getUTCDate();
  const result = new Date(source.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  result.setUTCHours(source.getUTCHours(), source.getUTCMinutes(), source.getUTCSeconds(), source.getUTCMilliseconds());
  return result;
}

function isPaidTier(card) {
  return card && card.tier === "paid";
}

function computeExpiresAt(publishedAt, tier) {
  const start = asDate(publishedAt);
  if (!start) return null;
  return isPaidTier({ tier }) ? addCalendarMonths(start, PAID_LIFETIME_MONTHS) : addDays(start, FREE_LIFETIME_DAYS);
}

function computeEditUntil(publishedAt) {
  const start = asDate(publishedAt);
  if (!start) return null;
  return addHours(start, EDIT_WINDOW_HOURS);
}

function isExpired(card, now = new Date()) {
  if (!card) return false;
  if (card.rejectionReason === PUBLICATION_EXPIRED_REASON || card.rejection_reason === PUBLICATION_EXPIRED_REASON) {
    return true;
  }
  const expiresAt = asDate(card.expiresAt || card.expires_at);
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

function isLive(card, now = new Date()) {
  if (!card || card.deleted) return false;
  const status = card.status;
  if (status !== "approved" && status !== "published") return false;
  return !isExpired(card, now);
}

function resolveEditUntil(card) {
  const publishedAt = asDate(card && (card.publishedAt || card.published_at));
  const stored = asDate(card && (card.editUntil || card.edit_until));
  if (!publishedAt) return stored;
  const computed = computeEditUntil(publishedAt);
  if (!stored) return computed;
  // Backfill mistakenly set edit_until = published_at (zero-length window).
  if (stored.getTime() <= publishedAt.getTime() + 60 * 1000) return computed;
  return stored;
}

function canUserEditCard(card, now = new Date()) {
  if (!card || card.deleted) return false;
  const status = card.status;
  if (status === "pending" || status === "draft" || status === "rejected") return true;
  if (isExpired(card, now)) return false;
  const publishedAt = asDate(card.publishedAt || card.published_at);
  if (!publishedAt) return true;
  const editUntil = resolveEditUntil(card);
  return Boolean(editUntil && now.getTime() <= editUntil.getTime());
}

function assertUserCanEditCard(card, now = new Date()) {
  if (canUserEditCard(card, now)) return true;
  if (isExpired(card, now)) {
    throw httpError(403, "Срок публикации истёк. Продлите карточку через оплату ALBA.", "PUBLICATION_EXPIRED");
  }
  throw httpError(403, "Бесплатное редактирование доступно 24 часа после одобрения. Дальше — только новая карточка.", "EDIT_WINDOW");
}

function publicationFieldsOnApprove(card, now = new Date()) {
  const current = card || {};
  const alreadyLive = Boolean(asDate(current.publishedAt || current.published_at)) && !isExpired(current, now);
  if (alreadyLive) {
    return {
      status: "approved",
      rejectionReason: ""
    };
  }
  const publishedAt = now;
  return {
    status: "approved",
    rejectionReason: "",
    publishedAt,
    expiresAt: computeExpiresAt(publishedAt, current.tier),
    editUntil: computeEditUntil(publishedAt)
  };
}

function republicationResetFields() {
  return {
    status: "pending",
    tier: "paid",
    tierRequested: "paid",
    paymentStatus: "paid",
    rejectionReason: "",
    publishedAt: null,
    expiresAt: null,
    editUntil: null
  };
}

function isAutoRenewEnabled(card) {
  return Boolean(card && (card.autoRenew === true || card.auto_renew === true));
}

function shouldAttemptAutoRenew(card, now = new Date()) {
  if (!card || card.deleted) return false;
  if (!isAutoRenewEnabled(card)) return false;
  if (!isExpired(card, now)) return false;
  const status = card.status;
  if (status === "approved" || status === "published") return true;
  if (status === "rejected") {
    const reason = card.rejectionReason || card.rejection_reason || "";
    return reason === PUBLICATION_EXPIRED_REASON;
  }
  return false;
}

function autoRenewExtensionFields(now = new Date()) {
  const start = now instanceof Date ? now : new Date(now);
  return {
    status: "approved",
    rejectionReason: "",
    tier: "paid",
    tierRequested: "paid",
    paymentStatus: "paid",
    expiresAt: addCalendarMonths(start, PAID_LIFETIME_MONTHS)
  };
}

function autoRenewIdempotencyKey(card) {
  const id = card && (card.id != null ? card.id : card._id);
  const expiresAt = asDate(card && (card.expiresAt || card.expires_at));
  const stamp = expiresAt ? expiresAt.toISOString() : "none";
  return `auto-renew:${id}:${stamp}`.slice(0, 100);
}

function livePublicationClause(now = new Date()) {
  return {
    [Op.or]: [
      { expiresAt: { [Op.gt]: now } },
      { expiresAt: { [Op.is]: null } }
    ]
  };
}

const LIVE_PUBLICATION_SQL = "(expires_at IS NULL OR expires_at > NOW())";

module.exports = {
  FREE_LIFETIME_DAYS,
  PAID_LIFETIME_MONTHS,
  EDIT_WINDOW_HOURS,
  PUBLICATION_EXPIRED_REASON,
  asDate,
  addDays,
  addHours,
  addCalendarMonths,
  computeExpiresAt,
  computeEditUntil,
  resolveEditUntil,
  isExpired,
  isLive,
  canUserEditCard,
  assertUserCanEditCard,
  publicationFieldsOnApprove,
  republicationResetFields,
  isAutoRenewEnabled,
  shouldAttemptAutoRenew,
  autoRenewExtensionFields,
  autoRenewIdempotencyKey,
  livePublicationClause,
  LIVE_PUBLICATION_SQL
};
