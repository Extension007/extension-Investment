const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Автоматическая конфигурация через CLOUDINARY_URL из .env
cloudinary.config();

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
