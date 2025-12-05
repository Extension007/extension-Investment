// Middleware для безопасности
const mongoSanitize = require("express-mongo-sanitize");
const sanitizeHtml = require("sanitize-html");

// Санитизация NoSQL injection
const sanitizeMongo = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`⚠️ Потенциальная NoSQL injection попытка в поле: ${key}`);
  }
});

// Санитизация HTML
function sanitizeHtmlInput(req, res, next) {
  // Санитизируем body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeHtml(req.body[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }
  
  // Санитизируем query
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeHtml(req.query[key], {
          allowedTags: [],
          allowedAttributes: {}
        });
      }
    });
  }
  
  next();
}

module.exports = {
  sanitizeMongo,
  sanitizeHtmlInput
};





