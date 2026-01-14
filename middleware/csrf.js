// CSRF защита
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Условная инициализация CSRF middleware в зависимости от среды
const isVercel = Boolean(process.env.VERCEL);

// Для Vercel среды отключаем CSRF защиту, т.к. она может вызывать проблемы с serverless функциями
const csrfProtection = isVercel ? 
  (req, res, next) => next() : // Пропускаем CSRF в Vercel
  csrf({ cookie: true });

// Middleware для генерации CSRF токена
function csrfToken(req, res, next) {
  // В Vercel среде просто передаем управление дальше
  if (isVercel) {
    res.locals.csrfToken = '';
    next();
  } else {
    // В противном случае генерируем токен
    if (typeof req.csrfToken === 'function') {
      res.locals.csrfToken = req.csrfToken();
    }
    next();
  }
}

module.exports = { csrfToken, csrfProtection };
