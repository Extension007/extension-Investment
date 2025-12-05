module.exports = (err, req, res, next) => {
  // Обработчик ошибок согласно требованиям
  console.error(err.stack);
  
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  res.status(500).json({ error: 'Internal Server Error' });
};


