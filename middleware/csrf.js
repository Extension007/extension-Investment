// CSRF защита
const csrf = require("csrf");
const csrfInstance = new csrf();
const csrfSecret = process.env.CSRF_SECRET || "default-csrf-secret-change-in-production";

// Middleware для генерации CSRF токена (один на сессию)
function csrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = csrfInstance.create(csrfSecret);
    console.log("✅ CSRF token generated and stored in session");
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

// Middleware для проверки CSRF токена
function csrfProtection(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const token =
    req.body._csrf ||
    req.query._csrf ||
    req.headers["x-csrf-token"];

  if (!token) {
    console.warn("❌ CSRF token missing");
    return res.status(403).json({ success: false, message: "CSRF token required" });
  }

  try {
    const isValid = csrfInstance.verify(csrfSecret, token);
    if (!isValid) {
      console.warn("❌ Invalid CSRF token");
      return res.status(403).json({ success: false, message: "Invalid CSRF token" });
    }
    console.log("✅ CSRF token valid");
    next();
  } catch (err) {
    console.error("❌ CSRF verification error:", err);
    return res.status(403).json({ success: false, message: "CSRF verification failed" });
  }
}

module.exports = { csrfToken, csrfProtection };

