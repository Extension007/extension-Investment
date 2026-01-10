const emailConfig = require('../config/email');

function requireEmailVerification(req, res, next) {
  // Проверяем, включена ли верификация email
  if (!emailConfig.enabled) {
    return next();
  }

  // Проверяем, аутентифицирован ли пользователь
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  // Проверяем, подтвержден ли email
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED',
      verificationRequired: true
    });
  }

  // Email подтвержден, продолжаем
  next();
}

module.exports = { requireEmailVerification };
