const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const ejs = require("ejs");
const path = require("path");
const { Op } = require("sequelize");
const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");
const { sendMail } = require("./emailService");
const { normalizeLocale, emailCopy, interpolate } = require("./emailTemplateI18n");
const { ensureVerificationTokensTable } = require("./emailVerificationService");

const DEFAULT_BASE_URL = "http://localhost:3000";
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const PURPOSE = "password_reset";
const MIN_PASSWORD_LEN = 6;

function resolveBaseUrl() {
  const baseUrl = process.env.BASE_URL;
  if (baseUrl) return baseUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("BASE_URL must be set in production for email links.");
  }
  return DEFAULT_BASE_URL;
}

function resolveSupportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || "support@albamount.xyz";
}

function validityLabel(locale) {
  if (locale === "ru") return "1 час";
  if (locale === "kk") return "1 сағат";
  if (locale === "zh") return "1 小时";
  return "1 hour";
}

/**
 * Always returns a generic success shape (anti-enumeration).
 * Email is sent only when the account exists and emailVerified is true.
 */
async function requestPasswordReset({ email, locale = "en" }) {
  const normalized = String(email || "").trim().toLowerCase();
  const generic = {
    ok: true,
    messageKey: "auth.resetEmailSent"
  };
  if (!normalized || !normalized.includes("@")) {
    return generic;
  }

  await ensureVerificationTokensTable();

  const user = await User.findOne({ where: { email: normalized } });
  if (!user || !user.emailVerified) {
    return generic;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await VerificationToken.update(
    { used: true },
    { where: { userId: user.id, used: false, purpose: PURPOSE } }
  );

  await VerificationToken.create({
    userId: user.id,
    token,
    expiresAt,
    used: false,
    purpose: PURPOSE
  });

  const lng = normalizeLocale(locale);
  const localeCopy = emailCopy(lng);
  const copy = localeCopy.passwordReset;
  const baseUrl = resolveBaseUrl();
  const supportEmail = resolveSupportEmail();
  const resetLink = `${baseUrl}/reset-password/${token}`;
  const logoUrl = `${baseUrl}/albamount.png`;
  const validityPeriod = validityLabel(lng);

  try {
    const html = await ejs.renderFile(path.join(__dirname, "../views/emails/password-reset-template.ejs"), {
      locale: lng,
      subject: copy.subject,
      preheader: copy.preheader,
      username: user.username,
      resetLink,
      validityPeriod,
      baseUrl,
      logoUrl,
      supportEmail,
      copy,
      interpolate,
      footerHelpText: localeCopy.emailFooterHelp
    });
    const text = await ejs.renderFile(path.join(__dirname, "../views/emails/password-reset-template.txt.ejs"), {
      locale: lng,
      username: user.username,
      resetLink,
      validityPeriod,
      copy,
      interpolate
    });
    await sendMail({
      to: user.email,
      subject: copy.subject,
      html,
      text
    });
  } catch (err) {
    await VerificationToken.update(
      { used: true },
      { where: { userId: user.id, token, purpose: PURPOSE } }
    ).catch(() => {});
    throw err;
  }

  return generic;
}

async function findValidResetToken(token) {
  const raw = String(token || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(raw)) return null;

  await ensureVerificationTokensTable();

  const row = await VerificationToken.findOne({
    where: {
      token: raw,
      purpose: PURPOSE,
      used: false,
      expiresAt: { [Op.gt]: new Date() }
    }
  });
  if (!row) return null;

  const user = await User.findByPk(row.userId);
  if (!user || !user.emailVerified) return null;
  return { row, user };
}

async function resetPasswordWithToken({ token, password }) {
  const pwd = String(password || "");
  if (pwd.length < MIN_PASSWORD_LEN) {
    const err = new Error("password_too_short");
    err.code = "password_too_short";
    err.status = 400;
    throw err;
  }

  const found = await findValidResetToken(token);
  if (!found) {
    const err = new Error("invalid_or_expired");
    err.code = "invalid_or_expired";
    err.status = 400;
    throw err;
  }

  const { row, user } = found;
  const hash = await bcrypt.hash(pwd, 12);
  user.password_hash = hash;
  await user.save();

  row.used = true;
  await row.save();

  // Invalidate any other unused reset tokens for this user
  await VerificationToken.update(
    { used: true },
    { where: { userId: user.id, purpose: PURPOSE, used: false } }
  );

  return { username: user.username };
}

module.exports = {
  PURPOSE,
  requestPasswordReset,
  findValidResetToken,
  resetPasswordWithToken,
  MIN_PASSWORD_LEN
};
