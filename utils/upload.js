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
        allowed_formats: ["jpg", "png", "jpeg", "webp"]
      }
    });
    console.log("✅ Cloudinary настроен");
  } catch (err) {
    console.warn("⚠️  Ошибка настройки Cloudinary, используется локальное хранилище:", err.message);
    hasCloudinary = false;
  }
}

if (!hasCloudinary) {
  // Используем локальное хранилище
  const uploadsDir = path.join(__dirname, "..", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, file.fieldname + "-" + uniqueSuffix + ext);
    }
  });
  console.log("✅ Используется локальное хранилище файлов (uploads/)");
}

module.exports = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
