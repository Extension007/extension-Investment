// FIX: Конфигурация multer для загрузки до 5 изображений
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// FIX: Проверяем наличие Cloudinary переменных
let hasCloudinary = 
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && 
          process.env.CLOUDINARY_API_KEY && 
          process.env.CLOUDINARY_API_SECRET);

let storage;

if (hasCloudinary) {
  // FIX: Используем Cloudinary, если настроен
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
  } catch (err) {
    hasCloudinary = false;
  }
}

if (!hasCloudinary) {
  // FIX: Используем локальное хранилище
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
      cb(null, "image-" + uniqueSuffix + ext);
    }
  });
}

// FIX: Фильтр файлов - только изображения (PNG, JPEG, JPG, WEBP)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Недопустимый тип файла. Разрешены только: PNG, JPEG, JPG, WEBP'), false);
  }
};

// FIX: Базовая конфигурация multer с ограничениями
const multerConfig = multer({ 
  storage,
  fileFilter,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB на файл
    files: 5 // максимум 5 файлов
  }
});

// FIX: Middleware для загрузки массива изображений (до 5 штук)
const uploadImages = multerConfig.array('images', 5);

// FIX: Middleware для загрузки одного изображения (обратная совместимость)
const uploadSingle = multerConfig.single('image');

module.exports = {
  uploadImages,
  uploadSingle,
  multerConfig
};
