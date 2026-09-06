const {
  requestPasswordReset,
  findValidResetToken,
  resetPasswordWithToken,
  MIN_PASSWORD_LEN
} = require("../services/passwordResetService");
const logger = require("../utils/logger");

function csrfOf(req, res) {
  return (
    (typeof req.csrfToken === "function" ? req.csrfToken() : null) ||
    res.locals.csrfToken ||
    ""
  );
}

function localeOf(req, res) {
  return res.locals.locale || req.locale || "en";
}

function tMsg(res, key, fallback) {
  if (typeof res.locals.t === "function") {
    try {
      return res.locals.t(key);
    } catch (_) {
      /* fall through */
    }
  }
  return fallback;
}

exports.showForgotForm = (req, res) => {
  res.render("forgot-password", {
    error: null,
    success: null,
    csrfToken: csrfOf(req, res)
  });
};

exports.submitForgot = async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
  try {
    await requestPasswordReset({ email, locale: localeOf(req, res) });
  } catch (err) {
    logger.error({ msg: "password_reset_request_failed", error: err.message });
    // Still generic response — don't leak SMTP failures as "user exists"
  }
  const message = tMsg(
    res,
    "auth.resetEmailSent",
    "If that email is registered and verified, we sent a reset link."
  );
  if (wantsJson) {
    return res.json({ success: true, message });
  }
  return res.render("forgot-password", {
    error: null,
    success: message,
    csrfToken: csrfOf(req, res)
  });
};

exports.showResetForm = async (req, res) => {
  const token = String(req.params.token || "");
  const found = await findValidResetToken(token);
  if (!found) {
    return res.status(400).render("reset-password", {
      valid: false,
      token: "",
      error: tMsg(res, "auth.resetLinkInvalid", "This reset link is invalid or expired."),
      success: null,
      csrfToken: csrfOf(req, res),
      minPasswordLen: MIN_PASSWORD_LEN
    });
  }
  return res.render("reset-password", {
    valid: true,
    token,
    error: null,
    success: null,
    csrfToken: csrfOf(req, res),
    minPasswordLen: MIN_PASSWORD_LEN
  });
};

exports.submitReset = async (req, res) => {
  const token = String(req.params.token || req.body?.token || "");
  const password = String(req.body?.password || "");
  const password2 = String(req.body?.passwordConfirm || req.body?.password2 || "");
  const wantsJson = req.xhr || req.get("accept")?.includes("application/json");

  if (password !== password2) {
    const message = tMsg(res, "auth.passwordsMismatch", "Passwords do not match.");
    if (wantsJson) return res.status(400).json({ success: false, message });
    return res.status(400).render("reset-password", {
      valid: true,
      token,
      error: message,
      success: null,
      csrfToken: csrfOf(req, res),
      minPasswordLen: MIN_PASSWORD_LEN
    });
  }

  try {
    await resetPasswordWithToken({ token, password });
  } catch (err) {
    const code = err.code || "";
    let message = tMsg(res, "auth.resetLinkInvalid", "This reset link is invalid or expired.");
    if (code === "password_too_short") {
      message = tMsg(res, "auth.passwordTooShort", `Password must be at least ${MIN_PASSWORD_LEN} characters.`);
    }
    if (wantsJson) return res.status(err.status || 400).json({ success: false, message });
    return res.status(err.status || 400).render("reset-password", {
      valid: code !== "invalid_or_expired",
      token: code === "invalid_or_expired" ? "" : token,
      error: message,
      success: null,
      csrfToken: csrfOf(req, res),
      minPasswordLen: MIN_PASSWORD_LEN
    });
  }

  const message = tMsg(res, "auth.resetSuccess", "Password updated. You can sign in now.");
  if (wantsJson) {
    return res.json({ success: true, message, redirect: "/user/login" });
  }
  return res.render("reset-password", {
    valid: false,
    token: "",
    error: null,
    success: message,
    csrfToken: csrfOf(req, res),
    minPasswordLen: MIN_PASSWORD_LEN
  });
};
