const { Op } = require("sequelize");
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { sendVerificationEmail } = require("../services/emailVerificationService");
const { notifyAdmin } = require("../services/adminNotificationService");
const logger = require("../utils/logger");
const { isUniqueConstraintError, getDuplicateFieldMessage } = require("../utils/sequelizeErrors");

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const { normalizeAccountType } = require("../utils/accountType");
    const accountType = normalizeAccountType(req.body.accountType);
    if (!email || !password) {
      logger.error({ msg: 'register_missing_fields', email: !!email, password: !!password });
      return res.status(400).json({ success: false, message: req.t("api.fieldsRequired", "Please fill in required fields") });
    }
    if (!accountType) {
      return res.status(400).json({ success: false, message: req.t("auth.accountType", "Select an account type") });
    }

    const orConditions = [{ email }];
    if (username) {
      orConditions.push({ username });
    }

    const existingUser = await User.findOne({
      where: { [Op.or]: orConditions }
    });

    if (existingUser) {
      logger.warn({ msg: 'register_duplicate', email: existingUser.email === email });
      return res.status(400).json({ success: false, message: req.t("js.registerError", "Registration error") });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const { ensureUserRefCode } = require("../services/referralService");

    const user = await User.create({
      username: username || email.split("@")[0],
      email,
      password_hash: hashedPassword,
      role: "user",
      accountType,
      emailVerified: false
    });

    await ensureUserRefCode(user, User);

    const inviteCode = req.query.ref || req.body.ref || req.body.refCode;
    if (inviteCode) {
      const referrer = await User.findOne({ where: { refCode: inviteCode } });
      if (referrer && referrer.id !== user.id) {
        user.referredBy = referrer.id;
        await user.save();
      }
    }

    try {
      await notifyAdmin(
        "New user registration",
        "A new user has signed up.",
        {
          "Имя пользователя": user.username,
          Email: user.email,
          "Тип аккаунта": accountType === "services" ? "Услуги" : "Купи/продай",
          "Дата регистрации": new Date().toLocaleString("ru-RU"),
          "ID пользователя": user.id
        },
        { locale: req.locale }
      );
    } catch (notificationError) {
      logger.error({ msg: 'admin_notification_error', error: notificationError.message, stack: notificationError.stack });
    }

    const emailConfig = require("../config/email");
    if (emailConfig.enabled) {
      try {
        await sendVerificationEmail(user, req.locale);
      } catch (emailError) {
        if (user.role === "user") {
          await User.destroy({ where: { id: user.id } });
        }
        logger.error({ msg: 'verification_email_error', error: emailError.message, stack: emailError.stack });
        return res.status(500).json({
          success: false,
          message: req.t("auth.verifyEmailError", "Could not send verification email. Please try again later.")
        });
      }
    } else {
      user.emailVerified = true;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: req.t("auth.registerDone", "Registration complete. Check your email."),
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    logger.error({ msg: 'register_error', error: err.message, stack: err.stack });
    if (isUniqueConstraintError(err)) {
      return res.status(400).json({
        success: false,
        message: getDuplicateFieldMessage(err)
      });
    }
    return res.status(500).json({ success: false, message: req.t("js.registerError", "Registration error") });
  }
};

/**
 * Resolves a DB-synced user object with guaranteed shape, including email verification status.
 * Uses either existing freshUser (from session page / token) or revalidates from DB when needed.
 */
async function resolveUser(userId, includeRefresh = true) {
  const UserModel = require('../models/User');
  const freshUser = await UserModel.findByPk(userId, {
    attributes: ['id', 'username', 'role', 'emailVerified', 'email', 'accountType']
  });
  if (!freshUser) return null;

  const userPayload = {
    _id: freshUser.id.toString(),
    username: freshUser.username,
    role: freshUser.role,
    emailVerified: !!freshUser.emailVerified,
    email: freshUser.email || undefined,
    accountType: freshUser.accountType || 'showcase',
  };

  const token = require('../config/jwt').generateToken(userPayload);
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);

  const cookieOpts = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  };

  return { user: userPayload, token, cookieOpts, freshUser };
}

exports.userLogin = async (req, res) => {
  const { username, password } = req.body;
  const wantsJson =
    req.xhr ||
    req.get("accept")?.includes("application/json") ||
    Boolean(req.is && req.is("application/json"));

  const fail = (message, status = 401, extras = {}) => {
    if (wantsJson) {
      return res.status(status).json({ success: false, message, ...extras });
    }
    return res.status(status === 500 ? 500 : 200).render("user-login", {
      error: message,
      csrfToken: res.locals.csrfToken,
      ...extras
    });
  };

  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      logger.warn({ msg: 'user_login_failed', reason: 'user_not_found', username });
      return fail(req.t("auth.loginError", "Invalid username or password"));
    }
    if (user.role === "admin") {
      return fail(req.t("api.forbidden", "Access denied"), 403);
    }
    if (!user.emailVerified) {
      logger.warn({ msg: 'user_login_failed', reason: 'email_not_verified', userId: user.id });
      if (wantsJson) {
        return res.status(403).json({
          success: false,
          message: req.t("auth.verifyEmailPending", "Please confirm your email before signing in."),
          showResendVerification: true,
          email: user.email
        });
      }
      return res.render("user-login", {
        error: req.t("auth.verifyEmailPending", "Please confirm your email before signing in."),
        csrfToken: res.locals.csrfToken,
        showResendVerification: true,
        email: user.email
      });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      logger.warn({ msg: 'user_login_failed', reason: 'invalid_password', userId: user.id });
      return fail(req.t("auth.loginError", "Invalid username or password"));
    }

    const { user: userPayload, token, cookieOpts } = await resolveUser(user.id);

    if (!process.env.VERCEL && req.session) {
      req.session.user = userPayload;
    }
    res.cookie("exto_token", token, cookieOpts);

    logger.info({
      msg: "user_login_success",
      userId: user.id,
      username: user.username,
      role: user.role
    });

    if (wantsJson) {
      return res.json({ success: true, redirect: "/cabinet" });
    }
    return res.redirect("/cabinet");
  } catch (err) {
    logger.error({ msg: "user_login_error", error: err.message });
    if (wantsJson) {
      return res.status(500).json({ success: false, message: req.t("api.serverError", "Server error") });
    }
    return res.status(500).send(req.t("api.serverError", "Server error"));
  }
};

exports.adminLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.render("login", { error: req.t("auth.loginError", "Invalid username or password"), debug: null, csrfToken: res.locals.csrfToken });
    }
    if (user.role !== "admin") {
      return res.render("login", {
        error: req.t("api.forbidden", "Access denied"),
        debug: null,
        csrfToken: res.locals.csrfToken
      });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("login", { error: req.t("auth.loginError", "Invalid username or password"), debug: null, csrfToken: res.locals.csrfToken });
    }

    const { user: userPayload, token, cookieOpts } = await resolveUser(user.id);
    if (!userPayload) {
      return res.render("login", { error: req.t("auth.loginError", "Invalid username or password"), debug: null, csrfToken: res.locals.csrfToken });
    }

    // On Vercel there is no express-session — auth is JWT cookie only
    if (!process.env.VERCEL && req.session) {
      req.session.user = userPayload;
    }
    res.cookie("exto_token", token, cookieOpts);

    logger.info({ msg: "admin_login_success", userId: user.id, username: user.username });
    return res.redirect("/admin");
  } catch (err) {
    logger.error({ msg: "admin_login_error", error: err.message, stack: err.stack });
    return res.status(500).send(req.t("api.serverError", "Server error"));
  }
};

exports.logout = async (req, res) => {
  res.clearCookie("exto_user");
  res.clearCookie("exto_token");

  if (!process.env.VERCEL && req.session) {
    req.session.destroy((err) => {
      if (err) {
        logger.error({ msg: 'logout_error', error: err.message, stack: err.stack });
      }
    });
  }

  return res.json({ success: true, message: req.t("common.loggedOut", "Logged out") });
};
