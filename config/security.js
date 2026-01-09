// Конфигурация безопасности (Helmet, CSP)
const helmet = require("helmet");

/**
 * Создает и возвращает middleware для безопасности
 */
function createSecurityMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Разрешаем YouTube IFrame API для единой логики видео-плееров и inline скрипты для передачи данных
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.youtube.com", "https://youtube.com", "https://*.youtube.com"],
        // Разрешаем inline event handlers для атрибутов
        scriptSrcAttr: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        fontSrc: ["'self'", "https:", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:", "https://res.cloudinary.com"], // Добавляем Cloudinary
        // Разрешаем Instagram oEmbed API для единой логики видео-плееров и WebSocket для Socket.IO
        connectSrc: ["'self'", "https:", "wss:", "ws:", "https://api.instagram.com"],
        // Разрешаем все необходимые iframe источники для YouTube, VK, Instagram
        frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://youtu.be", "https://*.youtube.com", "https://www.youtube-nocookie.com", "https://m.youtube.com", "https://vk.com", "https://*.vk.com", "https://www.instagram.com", "https://*.instagram.com"],
        mediaSrc: ["'self'", "https:"],
        objectSrc: ["'none'"]
        // trustedTypes: ["youtube-widget-api"] // Убрано для совместимости с YouTube API
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  });
}

module.exports = {
  createSecurityMiddleware
};
