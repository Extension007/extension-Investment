const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Banner = require("../models/Banner");
const { HAS_MONGO } = require("../config/database");
const { requireUser } = require("../middleware/auth");
const { productLimiter } = require("../middleware/rateLimiter");
const { validateProduct, validateProductId } = require("../middleware/validators");
const { csrfProtection, csrfToken } = require("../middleware/csrf");
const upload = require("../utils/upload");
const { mobileOptimization } = require("../utils/upload");
const { createProduct, updateProduct } = require("../services/productService");
const { notifyAdmin } = require("../services/adminNotificationService");

const isVercel = Boolean(process.env.VERCEL);

// Условный CSRF middleware для Vercel
const conditionalCsrfToken = isVercel ? (req, res, next) => next() : csrfToken;
const conditionalCsrfProtection = isVercel ? (req, res, next) => next() : csrfProtection;

// Middleware для обработки ошибок multer
function handleMulterError(err, req, res, next) {
  if (err) {
    console.error("❌ Ошибка multer при загрузке файлов:", err);
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, message: "Размер файла превышает 5MB" });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ success: false, message: "Неожиданное поле для загрузки файла" });
    }
    if (err.message && err.message.includes('Недопустимый тип файла')) {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(400).json({ success: false, message: "Ошибка загрузки файлов: " + (err.message || "Неизвестная ошибка") });
  }
  next();
}

// Личный кабинет
router.get("/", requireUser, conditionalCsrfToken, async (req, res) => {
  if (!HAS_MONGO) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(503).json({ success: false, message: "Личный кабинет недоступен: нет БД" });
    return res.status(503).send("Личный кабинет недоступен: нет БД");
  }
  try {
    // Разделяем товары и услуги (исключаем удаленные)
    const myProducts = await Product.find({
      owner: req.user._id,
      deleted: { $ne: true },
      $or: [
        { type: "product" },
        { type: { $exists: false } },
        { type: null }
      ]
    }).sort({ _id: -1 });

    const myServices = await Product.find({
      owner: req.user._id,
      deleted: { $ne: true },
      type: "service"
    }).sort({ _id: -1 });

    // Получаем баннеры пользователя
    const myBanners = await Banner.find({
      owner: req.user._id
    }).sort({ _id: -1 });

    // Генерируем CSRF токен
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : '');

    res.render("cabinet", {
      user: req.user,
      products: myProducts,
      services: myServices || [],
      banners: myBanners || [],
      csrfToken: csrfTokenValue,
      socket_io_available: res.locals.socket_io_available
    });
  } catch (err) {
    console.error("❌ Ошибка загрузки кабинета:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка загрузки кабинета: " + err.message });
    res.status(500).send("Ошибка загрузки кабинета");
  }
});

// Пользователь создаёт карточку
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection, чтобы _csrf был доступен в req.body
// ВАЖНО: mobileOptimization должен быть ПЕРЕД upload для оптимизации лимитов на мобильных
router.post("/product", requireUser, productLimiter, mobileOptimization, upload.array("images", 5), handleMulterError, conditionalCsrfProtection, validateProduct, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Необходима авторизация" });
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      link: req.body.link,
      video_url: req.body.video_url,
      category: req.body.category,
      type: req.body.type,
      phone: req.body.phone,
      email: req.body.email,
      telegram: req.body.telegram,
      whatsapp: req.body.whatsapp,
      contact_method: req.body.contact_method,
      ownerId: req.user._id,
      status: "pending"
    };

    const created = await createProduct(productData, req.files || []);
    
    console.log("✅ Карточка создана пользователем:", {
      id: created._id.toString(),
      name: created.name,
      owner: created.owner.toString()
    });
    
    res.json({ success: true, productId: created._id });
  } catch (err) {
    console.error("❌ Ошибка создания карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка создания карточки: " + err.message });
  }
});

// Пользователь меняет цену своей карточки
router.post("/product/:id/price", requireUser, conditionalCsrfProtection, validateProductId, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    const price = req.body.price;
    if (!price || price.trim().length === 0) {
      return res.status(400).json({ success: false, message: "Цена не может быть пустой" });
    }
    const updated = await Product.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id, deleted: { $ne: true } },
      { price },
      { new: true }
    );
    if (!updated) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    res.json({ success: true, price: updated.price });
  } catch (err) {
    console.error("❌ Ошибка изменения цены:", err);
    res.status(500).json({ success: false, message: "Ошибка изменения цены" });
  }
});

// Получение формы редактирования товара
router.get("/product/:id/edit", requireUser, validateProductId, conditionalCsrfToken, async (req, res) => {
  if (!HAS_MONGO) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
    return res.status(503).send("Недоступно: отсутствует подключение к БД");
  }
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      owner: req.user._id,
      deleted: { $ne: true }
    });
    if (!product) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Карточка не найдена или у вас нет прав для редактирования" });
      return res.status(404).send("Карточка не найдена или у вас нет прав для редактирования");
    }

    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : null);

    res.render("products/edit", { product, user: req.user, mode: "user", csrfToken: csrfTokenValue });
  } catch (err) {
    console.error("❌ Ошибка получения товара для редактирования:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование товара пользователем
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection
router.post("/product/:id/edit", requireUser, productLimiter, mobileOptimization, upload.array("images", 5), handleMulterError, conditionalCsrfProtection, validateProductId, validateProduct, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    const updateData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      link: req.body.link,
      video_url: req.body.video_url,
      category: req.body.category,
      type: req.body.type,
      phone: req.body.phone,
      email: req.body.email,
      telegram: req.body.telegram,
      whatsapp: req.body.whatsapp,
      contact_method: req.body.contact_method,
      current_images: req.body.current_images
    };

    const updated = await updateProduct(
      req.params.id,
      updateData,
      req.files || [],
      { ownerId: req.user._id }
    );
    
    console.log("✅ Карточка обновлена пользователем:", {
      id: updated._id.toString(),
      name: updated.name,
      owner: updated.owner.toString()
    });
    
    // Проверяем, является ли запрос AJAX
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, product: updated });
    }
    // Перенаправляем на страницу редактирования
    res.redirect(`/cabinet/product/${updated._id}/edit`);
  } catch (err) {
    console.error("❌ Ошибка редактирования карточки:", err);
    if (err.message.includes("не найден") || err.message.includes("нет прав")) {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: "Ошибка редактирования карточки: " + err.message });
  }
});

// Загрузка баннера пользователем
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection
router.post("/banner", requireUser, productLimiter, upload.single("image"), handleMulterError, conditionalCsrfProtection, async (req, res) => {
  if (!HAS_MONGO) {
    return res.status(503).json({ success: false, message: "Нет БД" });
  }
  
  try {
    // Проверка наличия файла
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Изображение баннера обязательно" });
    }
    
    // Обработка пути к изображению
    let imageUrl = null;
    try {
      if (req.file.path && !req.file.path.startsWith('http')) {
        imageUrl = '/uploads/' + req.file.filename;
      } else {
        imageUrl = req.file.path;
      }
    } catch (fileErr) {
      console.error("❌ Ошибка обработки файла:", fileErr);
      return res.status(400).json({ success: false, message: "Ошибка обработки загруженного файла" });
    }
    
    // Обработка ownerId
    let ownerId = null;
    try {
      if (req.user && req.user._id) {
        const userId = req.user._id;
        if (mongoose.Types.ObjectId.isValid(userId)) {
          ownerId = new mongoose.Types.ObjectId(userId);
        } else {
          ownerId = userId;
        }
      } else {
        return res.status(401).json({ success: false, message: "Требуется авторизация" });
      }
    } catch (ownerErr) {
      console.error("❌ Ошибка обработки ownerId:", ownerErr);
      return res.status(400).json({ success: false, message: "Ошибка обработки данных пользователя" });
    }
    
    // Создание баннера
    const bannerData = {
      title: req.body.title || req.body.name || "Баннер",
      description: req.body.description || "",
      image_url: imageUrl,
      images: [imageUrl], // Добавляем в массив для совместимости
      link: req.body.link ? req.body.link.trim() : "",
      owner: ownerId,
      status: "pending",
      price: req.body.price || "",
      category: req.body.category || ""
    };
    
    const created = await Banner.create(bannerData);
    
    // Отправляем уведомление администратору о новом баннере
    try {
      await notifyAdmin(
        'Новый баннер на модерацию',
        `Загружен новый баннер пользователем и отправлен на модерацию.`,
        {
          'Заголовок': bannerData.title,
          'Описание': bannerData.description,
          'Ссылка': bannerData.link,
          'Категория': bannerData.category,
          'Цена': bannerData.price,
          'ID баннера': created._id.toString(),
          'Владелец': created.owner ? created.owner.toString() : 'Неизвестен',
          'Дата создания': new Date().toLocaleString('ru-RU')
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    console.log("✅ Баннер создан:", {
      id: created._id.toString(),
      status: created.status,
      owner: created.owner ? created.owner.toString() : 'null'
    });
    
    return res.json({ success: true, bannerId: created._id, banner: created });
  } catch (err) {
    console.error("❌ Ошибка создания баннера:", err);
    console.error("❌ Стек ошибки:", err.stack);
    
    // Возвращаем JSON с описанием ошибки
    return res.status(500).json({ 
      success: false, 
      error: "Internal Server Error",
      message: err.message || "Ошибка создания баннера"
    });
  }
});

// Получение формы редактирования баннера
router.get("/banner/:id/edit", requireUser, conditionalCsrfToken, async (req, res) => {
  if (!HAS_MONGO) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
    return res.status(503).send("Недоступно: отсутствует подключение к БД");
  }
  try {
    const banner = await Banner.findOne({ 
      _id: req.params.id, 
      owner: req.user._id
    });
    if (!banner) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Баннер не найден или у вас нет прав для редактирования" });
      return res.status(404).send("Баннер не найден или у вас нет прав для редактирования");
    }
    
    // Генерируем CSRF токен
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : '');
    
    res.render("products/edit", { 
      product: {
        _id: banner._id,
        name: banner.title,
        description: banner.description,
        price: banner.price,
        link: banner.link,
        video_url: banner.video_url,
        category: banner.category,
        images: banner.images || [],
        image_url: banner.image_url,
        status: banner.status,
        owner: banner.owner,
        type: "banner"
      }, 
      user: req.user, 
      mode: "user", 
      csrfToken: csrfTokenValue 
    });
  } catch (err) {
    console.error("❌ Ошибка получения баннера для редактирования:", err);
    console.error("❌ Стек ошибки:", err.stack);
    
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ 
        success: false, 
        error: "Internal Server Error",
        message: err.message || "Ошибка базы данных"
      });
    }
    return res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование баннера пользователем
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection
router.post("/banner/:id/edit", requireUser, productLimiter, mobileOptimization, upload.array("images", 5), handleMulterError, conditionalCsrfProtection, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    const banner = await Banner.findOne({ 
      _id: req.params.id, 
      owner: req.user._id
    });
    if (!banner) {
      return res.status(404).json({ success: false, message: "Баннер не найден или у вас нет прав для редактирования" });
    }

    // Обновляем данные
    banner.title = req.body.name || banner.title;
    banner.description = req.body.description || "";
    banner.price = req.body.price || "";
    banner.link = req.body.link || "";
    banner.video_url = req.body.video_url || "";
    banner.category = req.body.category || "";

    // Обработка изображений
    if (req.body.current_images) {
      const currentImages = Array.isArray(req.body.current_images) 
        ? req.body.current_images 
        : [req.body.current_images].filter(Boolean);
      banner.images = currentImages;
      banner.image_url = currentImages.length > 0 ? currentImages[0] : null;
    }

    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => {
        if (file.path && !file.path.startsWith('http')) {
          return '/uploads/' + file.filename;
        }
        return file.path;
      });
      banner.images = [...(banner.images || []), ...newImages].slice(0, 5);
      if (banner.images.length > 0 && !banner.image_url) {
        banner.image_url = banner.images[0];
      }
    }

    await banner.save();

    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, banner });
    }
    res.redirect(`/cabinet/banner/${banner._id}/edit`);
  } catch (err) {
    console.error("❌ Ошибка редактирования баннера:", err);
    res.status(500).json({ success: false, message: "Ошибка редактирования баннера: " + err.message });
  }
});

// Удаление товара/услуги пользователем
router.delete("/product/:id", requireUser, conditionalCsrfProtection, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    const product = await Product.findOne({ 
      _id: req.params.id, 
      owner: req.user._id,
      deleted: { $ne: true }
    });
    if (!product) {
      return res.status(404).json({ success: false, message: "Карточка не найдена или у вас нет прав для удаления" });
    }

    // Soft delete
    product.deleted = true;
    await product.save();

    // Отправляем уведомление администратору об удалении товара/услуги
    try {
      await notifyAdmin(
        'Удаление товара/услуги',
        `Пользователь удалил товар или услугу.`,
        {
          'ID карточки': product._id.toString(),
          'Название': product.name,
          'Тип': product.type || 'product',
          'Владелец': product.owner ? product.owner.toString() : 'Неизвестен',
          'Дата удаления': new Date().toLocaleString('ru-RU')
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    res.json({ success: true, message: "Карточка удалена" });
  } catch (err) {
    console.error("❌ Ошибка удаления карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка удаления карточки: " + err.message });
  }
});

// Удаление баннера пользователем
router.delete("/banner/:id", requireUser, conditionalCsrfProtection, async (req, res) => {
  if (!HAS_MONGO) {
    return res.status(503).json({ success: false, message: "Нет БД" });
  }
  
  try {
    // Валидация ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Неверный формат ID баннера" });
    }
    
    // Проверка авторизации
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Требуется авторизация" });
    }
    
    const banner = await Banner.findOne({ 
      _id: req.params.id, 
      owner: req.user._id
    });
    
    if (!banner) {
      return res.status(404).json({ success: false, message: "Баннер не найден или у вас нет прав для удаления" });
    }

    // Удаляем изображения
    try {
      const { deleteImage, deleteImages } = require("../utils/imageUtils");
      if (banner.images && banner.images.length > 0) {
        await deleteImages(banner.images);
      } else if (banner.image_url) {
        await deleteImage(banner.image_url);
      }
    } catch (imgErr) {
      console.warn("⚠️ Ошибка удаления изображений баннера (продолжаем удаление):", imgErr);
      // Продолжаем удаление даже если не удалось удалить изображения
    }

    // Отправляем уведомление администратору об удалении баннера
    try {
      await notifyAdmin(
        'Удаление баннера',
        `Пользователь удалил баннер.`,
        {
          'ID баннера': req.params.id,
          'Заголовок': banner.title,
          'Владелец': banner.owner ? banner.owner.toString() : 'Неизвестен',
          'Дата удаления': new Date().toLocaleString('ru-RU')
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    // Полное удаление из БД
    await Banner.findByIdAndDelete(req.params.id);

    return res.json({ success: true, message: "Баннер удален" });
  } catch (err) {
    console.error("❌ Ошибка удаления баннера:", err);
    console.error("❌ Стек ошибки:", err.stack);
    
    return res.status(500).json({ 
      success: false, 
      error: "Internal Server Error",
      message: err.message || "Ошибка удаления баннера"
    });
  }
});

module.exports = router;
