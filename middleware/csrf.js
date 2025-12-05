// CSRF защита
const csrf = require("csurf");

// Настройка CSRF с поддержкой заголовка X-CSRF-Token и multipart форм
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  },
  value: (req) => {
    // Поддержка различных способов передачи токена
    // 1. Из req.body._csrf (для обычных форм и multipart после multer)
    // 2. Из заголовков (для AJAX запросов)
    // 3. Из query параметров (для обратной совместимости, не рекомендуется)
    return req.body?._csrf || 
           req.query?._csrf ||
           req.headers['csrf-token'] || 
           req.headers['xsrf-token'] || 
           req.headers['x-csrf-token'] || 
           req.headers['x-xsrf-token'];
  }
});

// Middleware для генерации CSRF токена (без проверки) - для GET запросов
// Создаем отдельный экземпляр csurf для генерации токенов
const csrfTokenGenerator = csrf({ 
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  },
  ignoreMethods: ['GET', 'HEAD', 'OPTIONS'] // Не проверяем токен для GET запросов
});

// Middleware для добавления CSRF токена в локальные переменные для шаблонов
// CSRF защита применяется только к POST/PUT/DELETE запросам через csrfProtection middleware
function csrfToken(req, res, next) {
  // Для GET запросов генерируем токен без проверки
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    csrfTokenGenerator(req, res, (err) => {
      if (err && err.code !== 'EBADCSRFTOKEN') {
        // Игнорируем CSRF ошибки для GET запросов, но обрабатываем другие ошибки
        return next(err);
      }
      res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
      next();
    });
  } else {
    // Для других методов пытаемся получить токен, если CSRF middleware уже применен
    try {
      res.locals.csrfToken = req.csrfToken ? req.csrfToken() : null;
    } catch (err) {
      // Если CSRF middleware еще не применен, токен будет null
      res.locals.csrfToken = null;
    }
    next();
  }
}

module.exports = {
  csrfProtection,
  csrfToken
};

