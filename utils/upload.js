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
  console.warn("⚠️  Cloudinary не настроен, но локальное хранилище недоступно в Vercel");
  // Вместо локального хранилища используем memory storage для временного хранения
  storage = multer.memoryStorage();
  console.log("✅ Используется временный storage в памяти (для Vercel)");
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

module.exports = multer({ 
  storage,
  fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB на файл
    files: 5 // максимум 5 файлов
  }
});
