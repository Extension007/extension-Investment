// utils/upload.js

const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;

// Настройка Cloudinary через переменные окружения
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Настройка хранилища для изображений
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products", // все изображения будут храниться в папке "products"
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 1200, height: 1200, crop: "limit" }],
  },
});

// Создаём middleware для загрузки
const upload = multer({ storage });

// Экспортируем, чтобы использовать в server.js
module.exports = upload;
