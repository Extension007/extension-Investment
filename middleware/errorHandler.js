module.exports = (err, req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;

  // Всегда логируем полную информацию для отладки
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  // Специфические обработчики ошибок
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      success: false,
      error: 'Invalid CSRF token',
      message: 'Пожалуйста, обновите страницу и попробуйте снова'
    });
  }

  // MongoDB ошибки подключения
  if (err.name === 'MongoNetworkError' || err.name === 'MongoTimeoutError') {
    return res.status(503).json({
      success: false,
      error: 'Database temporarily unavailable',
      message: 'Сервис временно недоступен. Попробуйте позже.'
    });
  }

  // Ошибки валидации
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: 'Проверьте правильность введенных данных',
      details: isProduction ? undefined : errors
    });
  }

  // Ошибки Multer (загрузка файлов)
  if (err.name === 'MulterError') {
    let message = 'Ошибка загрузки файла';
    if (err.code === 'LIMIT_FILE_SIZE') {
      message = 'Файл слишком большой';
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      message = 'Слишком много файлов';
    } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      message = 'Неверный тип файла';
    }

    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
      success: false,
      error: 'Upload Error',
      message
    });
  }

  // Определяем тип ответа (JSON или HTML)
  const wantsJson = req.xhr ||
                   req.get('accept')?.includes('application/json') ||
                   req.path.startsWith('/api/');

  if (wantsJson) {
    // JSON ответ для API запросов
    const response = {
      success: false,
      error: 'Internal Server Error',
      message: isProduction
        ? 'Произошла ошибка сервера. Попробуйте позже.'
        : err.message
    };

    // В разработке добавляем больше деталей
    if (!isProduction) {
      response.details = err.stack;
      response.name = err.name;
    }

    return res.status(500).json(response);
  } else {
    // HTML ответ для обычных запросов
    if (isProduction) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ошибка сервера</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
            .error-container { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #e74c3c; margin-bottom: 20px; }
            p { color: #666; line-height: 1.6; }
            .home-link { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 4px; }
            .home-link:hover { background: #2980b9; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Упс! Что-то пошло не так</h1>
            <p>Произошла временная ошибка сервера. Мы уже работаем над ее устранением.</p>
            <p>Пожалуйста, попробуйте обновить страницу через несколько минут.</p>
            <a href="/" class="home-link">Вернуться на главную</a>
          </div>
        </body>
        </html>
      `);
    } else {
      // В разработке показываем детали ошибки
      return res.status(500).send(`
        <!DOCTYPE html>
        <html lang="ru">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Ошибка сервера - Разработка</title>
          <style>
            body { font-family: monospace; padding: 20px; background: #f5f5f5; }
            .error-container { background: white; padding: 20px; border-radius: 8px; border-left: 5px solid #e74c3c; }
            h1 { color: #e74c3c; margin-bottom: 20px; }
            .error-details { background: #f8f8f8; padding: 15px; border-radius: 4px; font-size: 14px; white-space: pre-wrap; border: 1px solid #ddd; }
            .stack-trace { max-height: 400px; overflow-y: auto; }
          </style>
        </head>
        <body>
          <div class="error-container">
            <h1>Ошибка сервера (режим разработки)</h1>
            <div class="error-details">
              <strong>Ошибка:</strong> ${err.message}
              <br><br>
              <strong>Тип:</strong> ${err.name}
              <br><br>
              <strong>Стек вызовов:</strong>
              <div class="stack-trace">${err.stack}</div>
            </div>
            <br>
            <a href="/">← Вернуться на главную</a>
          </div>
        </body>
        </html>
      `);
    }
  }
};
