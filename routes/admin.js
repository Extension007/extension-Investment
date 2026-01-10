// Роуты для админ-панели
const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Banner = require("../models/Banner");
const User = require("../models/User");
const Statistics = require("../models/Statistics");
const { HAS_MONGO } = require("../config/database");
const { requireAdmin, requireAuth } = require("../middleware/auth");
const { productLimiter } = require("../middleware/rateLimiter");
const { validateProduct, validateProductId, validateService, validateServiceId, validateBanner, validateBannerId, validateModeration } = require("../middleware/validators");
const { csrfProtection, csrfToken } = require("../middleware/csrf");
const upload = require("../utils/upload");
const { createProduct, updateProduct, deleteProduct } = require("../services/productService");
const { deleteImages, deleteImage } = require("../utils/imageUtils");
const { CATEGORY_LABELS } = require("../config/constants");
const mongoose = require("mongoose");

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
    return res.status(400).json({ success: false, message: "Ошибка загрузки файлов: " + (err.message || "Неизвестная ошибка") });
  }
  next();
}

// Админка (главная страница)
router.get("/", requireAdmin, conditionalCsrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");
    
    // Разделяем товары и услуги (исключаем удаленные)
    const [allProducts, allServices, pendingProducts, pendingServices, allBanners, pendingBanners, visitors, users] = await Promise.all([
      Product.find({
        deleted: { $ne: true },
        $or: [
          { type: "product" },
          { type: { $exists: false } },
          { type: null }
        ]
      })
        .sort({ _id: -1 })
        .populate("owner", "username email"),

      Product.find({
        deleted: { $ne: true },
        type: "service"
      })
        .sort({ _id: -1 })
        .populate("owner", "username email"),

      Product.find({
        deleted: { $ne: true },
        $and: [
          { owner: { $ne: null, $exists: true } },
          {
            $or: [
              { status: "pending" },
              { status: { $exists: false } },
              { status: null }
            ]
          },
          {
            $or: [
              { type: "product" },
              { type: { $exists: false } },
              { type: null }
            ]
          }
        ]
      })
        .sort({ _id: -1 })
        .populate("owner", "username email"),

      Product.find({
        deleted: { $ne: true },
        $and: [
          { owner: { $ne: null, $exists: true } },
          {
            $or: [
              { status: "pending" },
              { status: { $exists: false } },
              { status: null }
            ]
          },
          { type: "service" }
        ]
      })
        .sort({ _id: -1 })
        .populate("owner", "username email"),

      Banner.find()
        .sort({ _id: -1 })
        .populate("owner", "username email"),

      Banner.find({
        $and: [
          { owner: { $ne: null, $exists: true } },
          {
            $or: [
              { status: "pending" },
              { status: { $exists: false } },
              { status: null }
            ]
          }
        ]
      })
        .sort({ _id: -1 })
        .populate("owner", "username email"),

      Statistics.findOneAndUpdate(
        { key: "visitors" },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ),

      User.countDocuments()
    ]);
    
    console.log(`📋 Всего товаров: ${allProducts.length}`);
    console.log(`🎯 Всего услуг: ${allServices.length}`);
    console.log(`⏳ Товаров на модерации: ${pendingProducts.length}`);
    console.log(`⏳ Услуг на модерации: ${pendingServices.length}`);
    console.log(`📋 Всего баннеров: ${allBanners.length}`);
    console.log(`⏳ Баннеров на модерации: ${pendingBanners.length}`);

    const visitorCount = visitors ? visitors.value : 0;
    const userCount = users || 0;

    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : null);

    res.render("admin", {
      products: allProducts,
      services: allServices || [],
      pendingProducts,
      pendingServices: pendingServices || [],
      banners: allBanners || [],
      pendingBanners: pendingBanners || [],
      visitorCount,
      userCount,
      categories: CATEGORY_LABELS,
      csrfToken: csrfTokenValue
    });
  } catch (err) {
    console.error("❌ Ошибка получения товаров (админ):", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление товара (админом - сразу approved)
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection, чтобы _csrf был доступен в req.body
router.post("/products", requireAdmin, productLimiter, upload.array("images", 5), handleMulterError, csrfProtection, validateProduct, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
  try {
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
      ownerId: null, // Админ создает без владельца
      status: "approved" // Админ создает сразу опубликованные
    };

    await createProduct(productData, req.files || []);
    
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, message: "Товар успешно добавлен" });
    }
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка добавления товара:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ success: false, message: "Ошибка добавления товара: " + err.message });
    }
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Удаление товара (soft delete)
router.post("/products/:id/delete", requireAdmin, conditionalCsrfProtection, validateProductId, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    await deleteProduct(req.params.id);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.json({ success: true, message: "Товар удален" });
    res.redirect("/admin/products");
  } catch (err) {
    console.error("❌ Ошибка удаления товара:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка удаления товара: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование товара (форма)
router.get("/products/:id/edit", requireAdmin, validateProductId, conditionalCsrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    const product = await Product.findById(req.params.id);
    if (!product || product.deleted) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Товар не найден" });
      return res.redirect("/admin");
    }
    
    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : null);
    
    res.render("products/edit", { product, mode: "admin", csrfToken: csrfTokenValue });
  } catch (err) {
    console.error("❌ Ошибка получения товара для редактирования:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование товара (сохранение)
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection
router.post("/products/:id/edit", requireAdmin, productLimiter, upload.array("images", 5), handleMulterError, csrfProtection, validateProductId, validateProduct, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
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

    await updateProduct(req.params.id, updateData, req.files || [], {});

    // Получаем обновленный продукт для редиректа
    const updated = await Product.findById(req.params.id);

    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, message: "Товар успешно обновлен" });
    }
    // Перенаправляем на страницу редактирования
    res.redirect(`/admin/products/${updated._id}/edit`);
  } catch (err) {
    console.error("❌ Ошибка редактирования товара:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ success: false, message: "Ошибка редактирования товара: " + err.message });
    }
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Модерация: одобрить карточку
router.post("/products/:id/approve", requireAdmin, conditionalCsrfProtection, validateProductId, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejection_reason: "" },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    res.json({ success: true, status: product.status });
  } catch (err) {
    console.error("❌ Ошибка одобрения карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка одобрения карточки" });
  }
});

// Модерация: отклонить карточку
router.post("/products/:id/reject", requireAdmin, conditionalCsrfProtection, validateProductId, validateModeration, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const { reason } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejection_reason: reason || "Несоответствие правилам публикации" },
      { new: true }
    );
    if (!product) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    res.json({ success: true, status: product.status, rejection_reason: product.rejection_reason });
  } catch (err) {
    console.error("❌ Ошибка отклонения карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка отклонения карточки" });
  }
});

// Блокировка карточки (скрытие с главной страницы)
router.post("/products/:id/toggle-visibility", requireAdmin, conditionalCsrfProtection, validateProductId, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: "Карточка не найдена" });
    
    const newStatus = product.status === "approved" ? "rejected" : "approved";
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { status: newStatus, rejection_reason: newStatus === "rejected" ? "Заблокировано администратором" : "" },
      { new: true }
    );
    
    res.json({ success: true, status: updated.status, message: newStatus === "rejected" ? "Карточка заблокирована" : "Карточка разблокирована" });
  } catch (err) {
    console.error("❌ Ошибка блокировки карточки:", err);
    res.status(500).json({ success: false, message: "Ошибка блокировки карточки" });
  }
});

// Блокировка/Разблокировка баннера
router.post("/banners/:id/toggle-visibility", requireAdmin, conditionalCsrfProtection, validateBannerId, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const banner = await Banner.findById(req.params.id);
    if (!banner) return res.status(404).json({ success: false, message: "Баннер не найден" });
    
    // Переключаем статус
    if (banner.status === "published" || banner.status === "approved") {
      banner.status = "blocked";
    } else {
      banner.status = "published";
    }
    
    await banner.save();
    res.json({ success: true, message: `Баннер ${banner.status === "blocked" ? "заблокирован" : "разблокирован"}`, status: banner.status });
  } catch (err) {
    console.error("❌ Ошибка переключения видимости баннера:", err);
    res.status(500).json({ success: false, message: "Ошибка изменения статуса баннера" });
  }
});

// Модерация баннеров: одобрить баннер
router.post("/banners/:id/approve", requireAdmin, conditionalCsrfProtection, validateBannerId, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejection_reason: "" },
      { new: true }
    );
    if (!banner) return res.status(404).json({ success: false, message: "Баннер не найден" });
    res.json({ success: true, status: banner.status });
  } catch (err) {
    console.error("❌ Ошибка одобрения баннера:", err);
    res.status(500).json({ success: false, message: "Ошибка одобрения баннера" });
  }
});

// Модерация баннеров: отклонить баннер
router.post("/banners/:id/reject", requireAdmin, conditionalCsrfProtection, validateBannerId, validateModeration, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const { reason } = req.body;
    const banner = await Banner.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejection_reason: reason || "Несоответствие правилам публикации" },
      { new: true }
    );
    if (!banner) return res.status(404).json({ success: false, message: "Баннер не найден" });
    res.json({ success: true, status: banner.status, rejection_reason: banner.rejection_reason });
  } catch (err) {
    console.error("❌ Ошибка отклонения баннера:", err);
    res.status(500).json({ success: false, message: "Ошибка отклонения баннера" });
  }
});

// Модерация: одобрить услугу
router.post("/services/:id/approve", requireAdmin, conditionalCsrfProtection, validateServiceId, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const service = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "approved", rejection_reason: "" },
      { new: true }
    );
    if (!service) return res.status(404).json({ success: false, message: "Услуга не найдена" });
    // Проверяем, что это действительно услуга
    if (service.type !== "service") {
      return res.status(400).json({ success: false, message: "Это не услуга" });
    }
    res.json({ success: true, status: service.status });
  } catch (err) {
    console.error("❌ Ошибка одобрения услуги:", err);
    res.status(500).json({ success: false, message: "Ошибка одобрения услуги" });
  }
});

// Модерация: отклонить услугу
router.post("/services/:id/reject", requireAdmin, conditionalCsrfProtection, validateServiceId, validateModeration, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const { reason } = req.body;
    const service = await Product.findByIdAndUpdate(
      req.params.id,
      { status: "rejected", rejection_reason: reason || "Несоответствие правилам публикации" },
      { new: true }
    );
    if (!service) return res.status(404).json({ success: false, message: "Услуга не найдена" });
    // Проверяем, что это действительно услуга
    if (service.type !== "service") {
      return res.status(400).json({ success: false, message: "Это не услуга" });
    }
    res.json({ success: true, status: service.status, rejection_reason: service.rejection_reason });
  } catch (err) {
    console.error("❌ Ошибка отклонения услуги:", err);
    res.status(500).json({ success: false, message: "Ошибка отклонения услуги" });
  }
});

// Блокировка услуги (скрытие с главной страницы)
router.post("/services/:id/toggle-visibility", requireAdmin, conditionalCsrfProtection, validateServiceId, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Нет БД" });
    const service = await Product.findById(req.params.id);
    if (!service) return res.status(404).json({ success: false, message: "Услуга не найдена" });
    
    // Проверяем, что это действительно услуга
    if (service.type !== "service") {
      return res.status(400).json({ success: false, message: "Это не услуга" });
    }
    
    const newStatus = service.status === "approved" ? "rejected" : "approved";
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { status: newStatus, rejection_reason: newStatus === "rejected" ? "Заблокировано администратором" : "" },
      { new: true }
    );
    
    res.json({ success: true, status: updated.status, message: newStatus === "rejected" ? "Услуга заблокирована" : "Услуга разблокирована" });
  } catch (err) {
    console.error("❌ Ошибка блокировки услуги:", err);
    res.status(500).json({ success: false, message: "Ошибка блокировки услуги" });
  }
});

// Редактирование услуги (форма)
router.get("/services/:id/edit", requireAdmin, validateServiceId, conditionalCsrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    const service = await Product.findById(req.params.id);
    if (!service || service.deleted) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Услуга не найдена" });
      return res.redirect("/admin");
    }
    
    // Проверяем, что это действительно услуга
    if (service.type !== "service") {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(40).json({ success: false, message: "Это не услуга" });
      return res.redirect("/admin");
    }
    
    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : null);
    
    res.render("products/edit", { service, mode: "admin", csrfToken: csrfTokenValue });
  } catch (err) {
    console.error("❌ Ошибка получения услуги для редактирования:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование услуги (сохранение)
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection
router.post("/services/:id/edit", requireAdmin, productLimiter, upload.array("images", 5), handleMulterError, csrfProtection, validateServiceId, validateService, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
  try {
    const service = await Product.findById(req.params.id);
    if (!service) {
      return res.status(404).json({ success: false, message: "Услуга не найдена" });
    }

    // Проверяем, что это действительно услуга
    if (service.type !== "service") {
      return res.status(400).json({ success: false, message: "Это не услуга" });
    }

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

    await updateProduct(req.params.id, updateData, req.files || [], {});

    // Получаем обновленную услугу для редиректа
    const updated = await Product.findById(req.params.id);

    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, message: "Услуга успешно обновлена" });
    }
    // Перенаправляем на страницу редактирования
    res.redirect(`/admin/services/${updated._id}/edit`);
  } catch (err) {
    console.error("❌ Ошибка редактирования услуги:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ success: false, message: "Ошибка редактирования услуги: " + err.message });
    }
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Удаление услуги (soft delete)
router.post("/services/:id/delete", requireAdmin, conditionalCsrfProtection, validateServiceId, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    const service = await Product.findById(req.params.id);
    if (!service) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Услуга не найдена" });
      return res.redirect("/admin");
    }

    // Проверяем, что это действительно услуга
    if (service.type !== "service") {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(400).json({ success: false, message: "Это не услуга" });
      return res.redirect("/admin");
    }

    await deleteProduct(req.params.id);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.json({ success: true, message: "Услуга удалена" });
    res.redirect("/admin/services");
  } catch (err) {
    console.error("❌ Ошибка удаления услуги:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка удаления услуги: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Каталог товаров
router.get("/products", requireAdmin, csrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    
    // Получаем все товары (type: "product" или без type)
    const products = await Product.find({
      deleted: { $ne: true },
      $or: [
        { type: "product" },
        { type: { $exists: false } },
        { type: null }
      ]
    })
      .sort({ createdAt: -1 })
      .populate("owner", "username email");
    
    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : '');
    
    res.render("admin-products", {
      products: products || [],
      csrfToken: csrfTokenValue,
      categories: CATEGORY_LABELS
    });
  } catch (err) {
    console.error("❌ Ошибка получения товаров:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Каталог услуг
router.get("/services", requireAdmin, csrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    
    // Получаем все услуги (type: "service")
    const services = await Product.find({ 
      type: "service",
      deleted: { $ne: true }
    })
      .sort({ createdAt: -1 })
      .populate("owner", "username email");
    
    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : '');
    
    res.render("admin-services", {
      services: services || [],
      csrfToken: csrfTokenValue
    });
  } catch (err) {
    console.error("❌ Ошибка получения услуг:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Каталог баннеров
router.get("/banners", requireAdmin, csrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    
    // Получаем все баннеры (для админа показываем все, не только published)
    const banners = await Banner.find()
      .sort({ createdAt: -1 })
      .populate("owner", "username email");
    
    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : '');
    
    res.render("admin-banners", {
      banners: banners || [],
      csrfToken: csrfTokenValue
    });
  } catch (err) {
    console.error("❌ Ошибка получения баннеров:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление баннера (админом)
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection
router.post("/banners", requireAdmin, productLimiter, upload.array("images", 5), handleMulterError, csrfProtection, validateBanner, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
  try {
    const { title, description, price, link, video_url, category, status } = req.body;
    
    // Валидация
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Название баннера обязательно" });
    }
    
    // Обработка изображений
    let images = [];
    let image_url = null;
    
    if (req.files && req.files.length > 0) {
      const filesToProcess = req.files.slice(0, 5);
      filesToProcess.forEach(file => {
        let imagePath = null;
        if (file.path && !file.path.startsWith('http')) {
          imagePath = '/uploads/' + file.filename;
        } else {
          imagePath = file.path;
        }
        if (imagePath) {
          images.push(imagePath);
        }
      });
      image_url = images.length > 0 ? images[0] : null;
    }
    
    const bannerData = {
      title: title.trim(),
      description: description ? description.trim() : "",
      price: price ? Number(price) : 0,
      link: link ? link.trim() : "",
      video_url: video_url ? video_url.trim() : "",
      category: category ? category.trim() : "",
      status: status || "published",
      images: images,
      image_url: image_url,
      owner: null, // Админ создает без владельца
      rating_up: 0,
      rating_down: 0
    };
    
    const banner = await Banner.create(bannerData);
    
    console.log("✅ Баннер создан:", { id: banner._id, title: banner.title });
    
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, message: "Баннер успешно добавлен", banner });
    }
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка добавления баннера:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ success: false, message: "Ошибка добавления баннера: " + err.message });
    }
    res.status(500).send("Ошибка загрузки изображения или базы данных");
  }
});

// Редактирование баннера (форма)
router.get("/banners/:id/edit", requireAdmin, validateBannerId, csrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Баннер не найден" });
      return res.redirect("/admin");
    }
    
    // Генерируем CSRF токен для формы и API запросов
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
      mode: "admin", 
      csrfToken: csrfTokenValue 
    });
  } catch (err) {
    console.error("❌ Ошибка получения баннера для редактирования:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование баннера (сохранение)
// ВАЖНО: multer должен быть ПЕРЕД csrfProtection
router.post("/banners/:id/edit", requireAdmin, productLimiter, upload.array("images", 5), handleMulterError, csrfProtection, validateBannerId, validateBanner, async (req, res) => {
  if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Баннер не найден" });
    }

    // Обновляем данные
    banner.title = req.body.name || banner.title;
    banner.description = req.body.description || "";
    banner.price = req.body.price ? Number(req.body.price) : 0;
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
      return res.json({ success: true, message: "Баннер успешно обновлен" });
    }
    res.redirect(`/admin/banners/${banner._id}/edit`);
  } catch (err) {
    console.error("❌ Ошибка редактирования баннера:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ success: false, message: "Ошибка редактирования баннера: " + err.message });
    }
    res.status(500).send("Ошибка базы данных");
  }
});

// Удаление баннера (POST для форм)
router.post("/banners/:id/delete", requireAdmin, conditionalCsrfProtection, validateBannerId, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
      return res.status(503).send("Недоступно: отсутствует подключение к БД");
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(400).json({ success: false, message: "Неверный формат ID баннера" });
      return res.status(400).send("Неверный формат ID баннера");
    }

    const bannerId = req.params.id;
    console.log("🗑️ Удаление баннера", { bannerId });

    // Найти баннер в базе
    const banner = await Banner.findById(bannerId);
    if (!banner) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Баннер не найден" });
      return res.status(404).send("Баннер не найден");
    }

    // Удалить изображения из Cloudinary
    if (banner.images && banner.images.length > 0) {
      for (const imageUrl of banner.images) {
        try {
          await deleteImage(imageUrl);
        } catch (err) {
          console.error("Ошибка удаления изображения:", err);
        }
      }
    } else if (banner.image_url) {
      try {
        await deleteImage(banner.image_url);
      } catch (err) {
        console.error("Ошибка удаления изображения:", err);
      }
    }

    // Удалить баннер из БД
    await Banner.findByIdAndDelete(bannerId);

    console.log("✅ Баннер удален:", { bannerId });
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.json({ success: true, message: "Баннер удален" });
    res.redirect("/admin/banners");
  } catch (err) {
    console.error("❌ Ошибка удаления баннера:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка удаления баннера: " + err.message });
    res.status(500).send("Ошибка базы данных");
  }
});

// Удаление баннера (DELETE для API)
router.delete("/banners/:id", requireAdmin, conditionalCsrfProtection, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      return res.status(503).json({ success: false, message: 'Недоступно: нет БД' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Неверный формат ID баннера" });
    }

    const bannerId = req.params.id;
    console.log("🗑️ Удаление баннера", { bannerId });

    // Найти баннер в базе
    const banner = await Banner.findById(bannerId);
    if (!banner) {
      return res.status(404).json({ success: false, message: "Баннер не найден" });
    }

    // Удаляем изображения из Cloudinary (или локального хранилища)
    if (banner.images && banner.images.length > 0) {
      console.log(`🔄 Удаление ${banner.images.length} изображений баннера из хранилища`);
      const deletedCount = await deleteImages(banner.images);
      console.log(`✅ Удалено ${deletedCount} из ${banner.images.length} изображений баннера`);
    } else if (banner.image_url) {
      console.log(`🔄 Удаление изображения баннера из хранилища: ${banner.image_url}`);
      const deleted = await deleteImage(banner.image_url);
      if (deleted) {
        console.log(`✅ Изображение баннера успешно удалено из хранилища`);
      } else {
        console.warn(`⚠️ Не удалось удалить изображение баннера из хранилища`);
      }
    }

    // Полное удаление из MongoDB
    await Banner.findByIdAndDelete(bannerId);

    console.log(`✅ Баннер ${bannerId} полностью удален из БД`);

    return res.json({ success: true, message: "Баннер успешно удален" });
  } catch (err) {
    if (err.code === 'EBADCSRFTOKEN') {
      console.error('❌ CSRF validation failed for banner deletion:', err);
      return res.status(403).json({ success: false, message: "Неверный CSRF-токен. Обновите страницу и попробуйте снова." });
    }
    console.error('❌ Ошибка удаления баннера:', err);
    return res.status(500).json({ success: false, message: "Ошибка сервера" });
  }
});

module.exports = router;
