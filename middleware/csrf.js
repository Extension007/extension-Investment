// CSRF защита
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Условная инициализация CSRF middleware в зависимости от среды
const isVercel = Boolean(process.env.VERCEL);

// CSRF protection uses cookie-based tokens in all environments.
const csrfProtection = csrf({ cookie: true });

// Middleware для генерации CSRF токена
function csrfToken(req, res, next) {
  // Generate a CSRF token when available.
  if (typeof req.csrfToken === 'function') {
    res.locals.csrfToken = req.csrfToken();
  } else {
    res.locals.csrfToken = '';
  }
  next();
}

module.exports = { csrfToken, csrfProtection };
