const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Проверяем, находимся ли мы в serverless окружении (Vercel, AWS Lambda и т.д.)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.FUNCTION_NAME);

// Проверяем наличие Cloudinary переменных
let hasCloudinary = 
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && 
          process.env.CLOUDINARY_API_KEY && 
          process.env.CLOUDINARY_API_SECRET);

// В serverless окружении Cloudinary обязателен
if (isServerless && !hasCloudinary) {
  console.error("❌ В serverless окружении (Vercel) Cloudinary обязателен!");
  console.error("⚠️  Установите переменные окружения:");
  console.error("   - CLOUDINARY_CLOUD_NAME");
  console.error("   - CLOUDINARY_API_KEY");
  console.error("   - CLOUDINARY_API_SECRET");
  throw new Error("Cloudinary configuration required in serverless environment. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.");
}

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
  // Используем локальное хранилище только если не serverless окружение
  if (isServerless) {
    throw new Error("Local file storage is not available in serverless environments. Please configure Cloudinary with CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.");
  }
  
  // Используем локальное хранилище
  const uploadsDir = path.join(__dirname, "..", "uploads");
  
  try {
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
  } catch (err) {
    // Если не удалось создать директорию, выбрасываем понятную ошибку
    console.error("❌ Ошибка настройки локального хранилища:", err.message);
    throw new Error(`Failed to create uploads directory: ${err.message}. Please check file system permissions or use Cloudinary.`);
  }
}

module.exports = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
