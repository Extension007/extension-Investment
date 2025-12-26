// CSRF защита
const csrf = require("csrf");

// Создаем экземпляр CSRF
const tokens = new csrf();

// Настройка CSRF middleware
function csrfProtection(req, res, next) {
  // Пропускаем CSRF проверку для GET запросов
  if (req.method === 'GET') {
    return next();
  }

  // Получаем токен из заголовка или тела запроса
  const token = req.get('X-CSRF-Token') || 
                req.body._csrf || 
                req.query._csrf ||
                req.headers['x-csrf-token'];

  // Получаем секрет из cookie
  const secret = req.cookies._csrfSecret;

  if (!secret) {
    return res.status(403).json({ 
      success: false, 
      message: "CSRF secret not found" 
    });
  }

  if (!token || !tokens.verify(secret, token)) {
    return res.status(403).json({ 
      success: false, 
      message: "Invalid CSRF token" 
    });
  }

  next();
}

// Middleware для генерации CSRF токена
function csrfToken(req, res, next) {
  // Генерируем секрет, если его нет
  if (!req.cookies._csrfSecret) {
    const secret = tokens.secretSync();
    res.cookie('_csrfSecret', secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    req.csrfSecret = secret;
  } else {
    req.csrfSecret = req.cookies._csrfSecret;
  }

  // Генерируем токен
  req.csrfToken = () => tokens.create(req.csrfSecret);
  
  // Добавляем токен в локальные переменные для шаблонов
  res.locals.csrfToken = req.csrfToken();
  
  next();
}

module.exports = {
  csrfProtection,
  csrfToken
};
