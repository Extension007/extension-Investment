const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Проверяем наличие Cloudinary переменных
let hasCloudinary = 
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && 
          process.env.CLOUDINARY_API_KEY && 
          process.env.CLOUDINARY_API_SECRET);

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
    console.log("📱 Мобильное устройство обнаружено, оптимизируем лимиты загрузки");
    // Для мобильных устройств без Cloudinary уменьшаем лимиты
    req.mobileLimits = {
      fileSize: 2 * 1024 * 1024, // 2MB на файл для мобильных
      files: 2 // максимум 2 файла для мобильных
    };
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
