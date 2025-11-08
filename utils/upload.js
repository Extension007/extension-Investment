const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Берём переменную окружения и убираем лишние пробелы/переносы
const url = (process.env.CLOUDINARY_URL || "").trim();

// Жёсткая проверка наличия и формата CLOUDINARY_URL
if (!url || !url.startsWith("cloudinary://")) {
  console.error("❌ CLOUDINARY_URL отсутствует или неверного формата");
  throw new Error("CLOUDINARY_URL is missing or invalid");
}

// Явная конфигурация Cloudinary через URL
cloudinary.config(url);

// Дополнительный лог (безопасный): убеждаемся, что SDK видит значения
console.log("🔧 Cloudinary config:", {
  cloud_name: cloudinary.config().cloud_name,
  api_key: (cloudinary.config().api_key || "").slice(0, 6) + "***",
  has_secret: !!cloudinary.config().api_secret
});

// Настройка хранилища Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products", // папка в Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "webp"], // допустимые форматы
    transformation: [{ width: 1200, height: 1200, crop: "limit" }] // ограничение размера
  }
});

// Настройка Multer с CloudinaryStorage
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // ограничение размера файла: 5MB
  }
});

module.exports = upload;
