// CSRF защита
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

// Инициализация CSRF middleware с использованием cookie
const csrfProtection = csrf({ cookie: true });

// Middleware для генерации CSRF токена
function csrfToken(req, res, next) {
  // Проверяем, существует ли метод req.csrfToken, и если да - сохраняем токен в res.locals
  if (typeof req.csrfToken === 'function') {
    res.locals.csrfToken = req.csrfToken();
  }
  next();
};

module.exports = { csrfToken, csrfProtection };

