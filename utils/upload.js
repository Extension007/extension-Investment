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

      if (req.isMobile && !hasCloudinary) {
        req.skipImageUpload = true;
        req.files = [];
        console.log(`📱 Mobile user without Cloudinary - image upload skipped for product creation`);
        return next();
      }

      if (req.isMobile && hasCloudinary) {
        try {
          const { CloudinaryStorage } = require("multer-storage-cloudinary");
          const cloudinary = require("cloudinary").v2;

          cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });

          const storage = new CloudinaryStorage({
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

          const upload = multer({
            storage,
            fileFilter,
            limits: {
              fileSize: maxFileSize,
              files: maxFiles,
            },
          }).array("images", maxFiles);

          upload(req, res, (err) => {
            if (err) {
              return next(err);
            }
            next();
          });
        } catch (cloudinaryErr) {
          console.warn("Cloudinary init failed for mobile, skipping image upload:", cloudinaryErr.message);
          req.skipImageUpload = true;
          req.files = [];
          console.log(`📱 Mobile user Cloudinary failed - image upload skipped for product creation`);
          return next();
        }
      } else if (!req.isMobile) {
        let storage;

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
          } catch (cloudinaryErr) {
            console.warn("Cloudinary init failed for desktop, falling back to local storage:", cloudinaryErr.message);
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
          const uploadDir = ensureUploadDir();
          storage = multer.diskStorage({
            destination: (req, file, cb) => cb(null, uploadDir),
            filename: (req, file, cb) => {
              const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
              cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
            },
          });
        }

        const upload = multer({
          storage,
          fileFilter,
          limits: {
            fileSize: maxFileSize,
            files: maxFiles,
          },
        }).array("images", maxFiles);

        upload(req, res, (err) => {
          if (err) {
            return next(err);
          }
          next();
        });
      } else {
        next();
      }
    } catch (initErr) {
      console.error("createImageUpload error:", initErr);
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
