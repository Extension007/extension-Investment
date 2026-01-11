const multer = require("multer");
const path = require("path");
const fs = require("fs");

function ensureUploadDir() {
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
}

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only PNG, JPEG, JPG, WEBP allowed"), false);
  }
};

const mobileOptimization = (req, res, next) => {
  try {
    const userAgent = req.get("User-Agent") || "";
    req.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    next();
  } catch (err) {
    console.error("mobileOptimization error:", err);
    next();
  }
};

function createImageUpload(options = {}) {
  const { maxFiles = 5, maxFileSize = 5 * 1024 * 1024 } = options;

  return async (req, res, next) => {
    try {
      // Проверяем наличие Cloudinary конфигурации
      const hasCloudinaryConfig =
        (process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET) ||
        process.env.CLOUDINARY_URL;

      let storage;
      let useCloudinary = false;
      let cloudinaryAvailable = false;

      // Проверяем доступность Cloudinary
      if (hasCloudinaryConfig) {
        try {
          const cloudinary = require("cloudinary").v2;
          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });

          // Проверяем доступность Cloudinary с помощью ping
          await cloudinary.api.ping();
          cloudinaryAvailable = true;
        } catch (pingErr) {
          console.warn("Cloudinary недоступен, используем локальное хранилище:", pingErr.message);
        }
      }

      console.log(`📤 Upload request: device=${req.isMobile ? 'mobile' : 'desktop'}, cloudinary=${cloudinaryAvailable ? 'available' : 'unavailable'}`);

      // Используем Cloudinary только если она доступна
      if (cloudinaryAvailable) {
        try {
          const { CloudinaryStorage } = require("multer-storage-cloudinary");
          const cloudinary = require("cloudinary").v2;

          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });

          storage = new CloudinaryStorage({
            cloudinary,
            params: {
              folder: "products",
              allowed_formats: ["jpg", "png", "jpeg", "webp"],
              transformation: [
                { width: 1200, height: 120, crop: "limit" },
                { quality: "auto" },
                { fetch_format: "auto" },
              ],
            },
          });
          useCloudinary = true;
          console.log(`☁️ Cloudinary storage initialized for ${req.isMobile ? 'mobile' : 'desktop'} device`);
        } catch (cloudinaryErr) {
          console.warn("Cloudinary init failed, falling back to local storage:", cloudinaryErr.message);
          const uploadDir = ensureUploadDir();
          storage = multer.diskStorage({
            destination: (req, file, cb) => {
              try {
                cb(null, uploadDir);
              } catch (dirErr) {
                console.error("Ошибка доступа к директории uploads:", dirErr);
                cb(dirErr);
              }
            },
            filename: (req, file, cb) => {
              const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
              cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
            },
          });
        }
      } else {
        // Используем локальное хранилище как fallback
        try {
          const uploadDir = ensureUploadDir();
          storage = multer.diskStorage({
            destination: (req, file, cb) => {
              try {
                cb(null, uploadDir);
              } catch (dirErr) {
                console.error("Ошибка доступа к директории uploads:", dirErr);
                cb(dirErr);
              }
            },
            filename: (req, file, cb) => {
              const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
              cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
            },
          });
          console.log(`💾 Local storage initialized for ${req.isMobile ? 'mobile' : 'desktop'} device`);
        } catch (storageErr) {
          console.error("Ошибка инициализации локального хранилища:", storageErr);
          return res.status(500).json({ success: false, message: "Ошибка инициализации хранилища" });
        }
      }

      const multerInstance = multer({
        storage,
        fileFilter,
        limits: {
          fileSize: maxFileSize,
          files: maxFiles,
        },
      });

      const uploadMiddleware = multerInstance.array("images", maxFiles);

      console.log(`🔄 Starting upload middleware: device=${req.isMobile ? 'mobile' : 'desktop'}, storage=${useCloudinary ? 'Cloudinary' : 'local'}`);

      await new Promise((resolve, reject) => {
        uploadMiddleware(req, res, (err) => {
          if (err) {
            console.error("❌ Multer upload error:", err.message, err.code);
            console.error("❌ Full error:", err);

            let errorMessage = "Ошибка загрузки файлов";
            if (err.code === 'LIMIT_FILE_COUNT') {
              errorMessage = `Максимальное количество изображений: ${maxFiles}`;
            } else if (err.code === 'LIMIT_FILE_SIZE') {
              errorMessage = `Размер файла превышает ${maxFileSize / (1024 * 1024)}MB`;
            } else if (err.message && err.message.includes('Invalid file type')) {
              errorMessage = "Недопустимый тип файла. Разрешены только PNG, JPEG, JPG, WEBP";
            }

            return res.status(400).json({ success: false, message: errorMessage });
          }

          const fileCount = req.files ? req.files.length : 0;
          const totalSize = req.files ? req.files.reduce((sum, file) => sum + (file.size || 0), 0) : 0;
          const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

          console.log(`✅ Upload completed: ${fileCount} files, ${sizeMB}MB, storage=${useCloudinary ? 'Cloudinary' : 'local'}, device=${req.isMobile ? 'mobile' : 'desktop'}`);

          if (req.files && req.files.length > 0) {
            req.files.forEach((file, index) => {
              const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
              console.log(`📁 File ${index + 1}: ${file.originalname} (${fileSizeMB}MB)`);
            });
          }

          resolve();
        });
      });

      next();
    } catch (initErr) {
      console.error("❌ createImageUpload error:", initErr);
      // Проверяем, не был ли уже отправлен ответ
      if (res.headersSent) {
        console.error("❌ Заголовки уже отправлены, невозможно отправить ошибку");
        return;
      }
      return res.status(500).json({ success: false, message: "Ошибка инициализации загрузки" });
    }
  };
}

const upload = createImageUpload();
const bannerUpload = createImageUpload({ maxFiles: 1, maxFileSize: 5 * 1024 * 1024 });

module.exports = {
  upload,
  bannerUpload,
  createImageUpload,
  mobileOptimization,
};
