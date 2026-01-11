const multer = require("multer");
const path = require("path");
const fs = require("fs");

function createImageUpload(options = {}) {
  const { maxFiles = 5, maxFileSize = 5 * 1024 * 1024 } = options;

  return function(req, res, next) {
    try {
      const hasCloudinary = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      ) || Boolean(process.env.CLOUDINARY_URL);

      let storage;

      if (hasCloudinary) {
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
              transformation: [
                { width: 1200, height: 1200, crop: 'limit' },
                { quality: 'auto' },
                { fetch_format: 'auto' }
              ]
            }
          });
        } catch (cloudinaryErr) {
          console.warn("Cloudinary init failed, falling back to local storage:", cloudinaryErr.message);
          storage = multer.diskStorage({
            destination: function (req, file, cb) {
              const uploadDir = path.join(process.cwd(), 'uploads');
              if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
              }
              cb(null, uploadDir);
            },
            filename: function (req, file, cb) {
              const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
              cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
            }
          });
        }
      } else {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        storage = multer.diskStorage({
          destination: function (req, file, cb) {
            cb(null, uploadDir);
          },
          filename: function (req, file, cb) {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
          }
        });
      }

      const fileFilter = (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type. Only PNG, JPEG, JPG, WEBP allowed'), false);
        }
      };

      const upload = multer({
        storage,
        fileFilter,
        limits: {
          fileSize: maxFileSize,
          files: maxFiles
        }
      });

      const userAgent = req.get('User-Agent') || '';
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

      if (isMobile && !hasCloudinary) {
        req.skipImageUpload = true;
        return next();
      }

      upload.array("images", maxFiles)(req, res, function(err) {
        if (err) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              message: `File too large. Maximum size: ${maxFileSize / (1024 * 1024)}MB`
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              message: `Too many files. Maximum: ${maxFiles} files`
            });
          }
          if (err.message.includes('Invalid file type')) {
            return res.status(400).json({
              success: false,
              message: err.message
            });
          }
          return res.status(500).json({
            success: false,
            message: "Upload failed: " + err.message
          });
        }
        next();
      });

    } catch (initErr) {
      console.error("Upload initialization failed:", initErr);
      req.skipImageUpload = true;
      next();
    }
  };
}

const upload = createImageUpload();
const bannerUpload = createImageUpload({ maxFiles: 1, maxFileSize: 5 * 1024 * 1024 });

module.exports = upload;
module.exports.bannerUpload = bannerUpload;
module.exports.createImageUpload = createImageUpload;
