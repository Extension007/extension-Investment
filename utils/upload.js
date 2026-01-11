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
      const hasCloudinary =
        (process.env.CLOUDINARY_CLOUD_NAME &&
          process.env.CLOUDINARY_API_KEY &&
          process.env.CLOUDINARY_API_SECRET) ||
        process.env.CLOUDINARY_URL;

      console.log(`📤 Upload request: device=${req.isMobile ? 'mobile' : 'desktop'}, cloudinary=${hasCloudinary ? 'available' : 'unavailable'}`);

      if (req.isMobile && !hasCloudinary) {
        req.skipImageUpload = true;
        req.files = [];
        console.log(`📱 Mobile user without Cloudinary - image upload skipped for product creation`);
        return next();
      }

      let storage;
      let useCloudinary = false;

      if (hasCloudinary) {
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
                { width: 1200, height: 1200, crop: "limit" },
                { quality: "auto" },
                { fetch_format: "auto" },
              ],
            },
          });
          useCloudinary = true;
        } catch (cloudinaryErr) {
          console.warn("Cloudinary init failed, falling back to local storage:", cloudinaryErr.message);
          if (req.isMobile) {
            req.skipImageUpload = true;
            req.files = [];
            console.log(`📱 Mobile user Cloudinary failed - image upload skipped for product creation`);
            return next();
          }
          const uploadDir = ensureUploadDir();
          storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, uploadDir),
            filename: (req, file, cb) => {
              const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
              cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
            },
          });
        }
      } else {
        if (req.isMobile) {
          req.skipImageUpload = true;
          req.files = [];
          console.log(`📱 Mobile user without Cloudinary - image upload skipped for product creation`);
          return next();
        }
        const uploadDir = ensureUploadDir();
        storage = multer.diskStorage({
          destination: (req, file, cb) => cb(null, uploadDir),
          filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
          },
        });
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

      try {
        await new Promise((resolve, reject) => {
          uploadMiddleware(req, res, (err) => {
            if (err) {
              console.error("❌ Multer upload error:", err.message, err.code);
              console.error("❌ Full error:", err);
              return reject(err);
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
      } catch (uploadErr) {
        console.error("❌ Upload middleware failed:", uploadErr.message);
        if (req.isMobile) {
          console.log("📱 Mobile upload failed, skipping image upload");
          req.skipImageUpload = true;
          req.files = [];
          return next();
        }
        throw uploadErr;
      }

      next();
    } catch (initErr) {
      console.error("❌ createImageUpload error:", initErr);
      req.skipImageUpload = true;
      req.files = [];
      next();
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
