const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Проверяем наличие Cloudinary переменных (расширенная проверка)
let hasCloudinary =
  Boolean(process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET) ||
  Boolean(process.env.CLOUDINARY_URL); // Альтернативная проверка через CLOUDINARY_URL

console.log("🔍 Cloudinary переменные окружения:");
console.log("  CLOUDINARY_CLOUD_NAME:", Boolean(process.env.CLOUDINARY_CLOUD_NAME));
console.log("  CLOUDINARY_API_KEY:", Boolean(process.env.CLOUDINARY_API_KEY));
console.log("  CLOUDINARY_API_SECRET:", Boolean(process.env.CLOUDINARY_API_SECRET));
console.log("  CLOUDINARY_URL:", Boolean(process.env.CLOUDINARY_URL));
console.log("  hasCloudinary:", hasCloudinary);

let storage;

if (hasCloudinary) {
  // Используем Cloudinary, если настроен
  try {
    const { CloudinaryStorage } = require("multer-storage-cloudinary");
    const cloudinary = require("cloudinary").v2;

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    storage = new CloudinaryStorage({
      cloudinary,
      params: {
        folder: "products",
        allowed_formats: ["jpg", "png", "jpeg", "webp"],
        // Оптимизация при загрузке
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' }, // Ограничиваем максимальный размер
          { quality: 'auto' }, // Автоматическое качество
          { fetch_format: 'auto' } // WebP для поддерживающих браузеров
        ]
      }
    });
    console.log("✅ Cloudinary настроен");
  } catch (err) {
    console.warn("⚠️  Ошибка настройки Cloudinary, используется локальное хранилище:", err.message);
    hasCloudinary = false;
  }
}

if (!hasCloudinary) {
  // В Vercel локальное хранилище недоступно
  console.warn("⚠️  Cloudinary не настроен, используется memory storage");
  // ВНИМАНИЕ: Memory storage может вызывать SERVICE_UNAVAILABLE (503) при загрузке файлов с мобильных устройств
  // из-за высокого потребления памяти, особенно в регионе fra1 с ограниченными ресурсами
  // РЕКОМЕНДАЦИЯ: Настройте Cloudinary для избежания проблем с производительностью

  // Оптимизация для мобильных устройств: уменьшаем лимиты для предотвращения OOM
  storage = multer.memoryStorage();
  console.log("✅ Используется memory storage (для Vercel) - проверьте настройки Cloudinary для мобильных устройств");
}

// FIX: Фильтр файлов - только изображения
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только PNG, JPEG, JPG, WEBP'), false);
  }
};

// Middleware для оптимизации загрузки файлов на мобильных устройствах
const mobileOptimization = (req, res, next) => {
  // Определяем мобильное устройство по User-Agent
  const userAgent = req.get('User-Agent') || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

  if (isMobile && !hasCloudinary) {
    console.log("📱 Мобильное устройство обнаружено без Cloudinary - отключаем загрузку файлов для предотвращения SERVICE_UNAVAILABLE");
    // Для мобильных устройств без Cloudinary полностью отключаем загрузку файлов
    // Это гарантированно предотвратит проблемы с памятью в Vercel
    req.mobileDisabled = true;
    return res.status(400).json({
      success: false,
      message: "Загрузка изображений с мобильных устройств временно недоступна. Пожалуйста, используйте компьютер для создания карточек с изображениями, или обратитесь к администратору для настройки Cloudinary.",
      mobileDisabled: true,
      recommendation: "Настройте переменные окружения CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY и CLOUDINARY_API_SECRET для включения загрузки с мобильных устройств."
    });
  }

  // Если Cloudinary настроен, мобильные устройства работают нормально
  if (isMobile && hasCloudinary) {
    console.log("📱 Мобильное устройство обнаружено с Cloudinary - загрузка разрешена");
  }

  next();
};

// Создаем multer с динамическими лимитами
const createMulterUpload = (req, res, next) => {
  const limits = req.mobileLimits || {
    fileSize: 5 * 1024 * 1024, // 5MB на файл
    files: 5 // максимум 5 файлов
  };

  const upload = multer({
    storage,
    fileFilter,
    limits
  });

  // Применяем middleware
  return upload.any()(req, res, next);
};

// Для обратной совместимости экспортируем обычный multer upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB на файл
    files: 5 // максимум 5 файлов
  }
});

// Экспортируем обычный upload для совместимости
module.exports = upload;

// Экспортируем оптимизированный upload для новых маршрутов
module.exports.createMulterUpload = createMulterUpload;
module.exports.mobileOptimization = mobileOptimization;
