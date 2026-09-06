const express = require("express");
const router = express.Router();
const logger = require("../utils/logger");
const { Op } = require('sequelize');
const Product = require("../models/Product");
const Category = require("../models/Category");
const User = require("../models/User");
const AlbaTransaction = require("../models/AlbaTransaction");
const { USE_POSTGRES } = require("../config/database");
const { requireUser, requireAdmin, requireAuth, requireOwnerOrAdmin, getAuthUserId } = require("../middleware/auth");
const { productLimiter } = require("../middleware/rateLimiter");
const { validateProduct, validateProductId } = require("../middleware/validators");
const { csrfProtection, csrfToken } = require("../middleware/csrf");
const { upload, mobileOptimization } = require("../utils/upload");
const { publicErrorMessage } = require("../utils/httpError");
const { createProduct, updateProduct } = require("../services/productService");
const { notifyAdmin } = require("../services/adminNotificationService");
const { getUserAlbaBalance } = require("../services/albaService");
const { allowedCardType, assertCanCreateCardType } = require("../utils/accountType");
const { translateTree, localizeHierarchicalCategories } = require("../utils/categoryI18n");
const { canUserEditCard, assertUserCanEditCard } = require("../utils/cardPublication");
const { expirePublishedCards, republishCard, setCardAutoRenew } = require("../services/cardPublicationService");

const isVercel = Boolean(process.env.VERCEL);

function sendAccountTypeError(req, res, err) {
  const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
  const status = err.status || 403;
  if (wantsJson) return res.status(status).json({ success: false, message: err.message });
  return res.status(status).send(err.message);
}

const conditionalCsrfToken = csrfToken;
const conditionalCsrfProtection = csrfProtection;

// Middleware для обработки ошибок multer
function handleMulterError(err, req, res, next) {
  if (err) {
    logger.error({ msg: 'cabinet_error', error: err.message, stack: err.stack, path: req.path });
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
router.get("/", conditionalCsrfToken, requireUser, async (req, res) => {
  try {
    const userId = getAuthUserId(req.user);
    if (!userId) {
      const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
      if (wantsJson) return res.status(401).json({ success: false, message: 'Необходима авторизация' });
      return res.redirect('/user/login');
    }

    const userData = req.session?.user || req.user;
    if (!userData) {
      return res.redirect('/user/login');
    }

    if (!USE_POSTGRES) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(503).json({ success: false, message: "Личный кабинет недоступен: нет БД" });
      return res.status(503).send("Личный кабинет недоступен: нет БД");
    }

    let freshUser;
    try {
      freshUser = await User.findByPk(getAuthUserId(req.user), {
        attributes: ['id', 'username', 'email', 'role', 'emailVerified', 'accountType', 'albaBalance', 'refCode', 'referredBy', 'refBonusGranted', 'createdAt', 'updatedAt']
      });
    } catch (userErr) {
      logger.error({ msg: 'cabinet_error', error: userErr.message, stack: userErr.stack, path: req.path });
      freshUser = null;
    }
    if (!freshUser) {
      return res.status(500).send("Ошибка загрузки пользователя");
    }

    const isShowcaseAccount = (freshUser.accountType || 'showcase') !== 'services';
    try {
      await expirePublishedCards({ ownerId: userId });
    } catch (expireErr) {
      logger.warn({ msg: 'cabinet_expire_cards', error: expireErr.message });
    }
    let myProducts = [];
    let myServices = [];
    if (isShowcaseAccount) {
      myProducts = await Product.findAll({
        where: {
          ownerId: userId,
          deleted: false,
          [Op.or]: [
            { type: "product" },
            { type: null }
          ]
        },
        order: [['id', 'DESC']]
      });
    } else {
      myServices = await Product.findAll({
        where: {
          ownerId: userId,
          deleted: false,
          type: "service"
        },
        order: [['id', 'DESC']]
      });
    }

    let categoryTree;
    try {
      categoryTree = await Category.getTree('all');
    } catch (categoryErr) {
      logger.error({ msg: 'cabinet_error', error: categoryErr.message, stack: categoryErr.stack, path: req.path });
      categoryTree = [];
    }

    let categoryFlat;
    try {
      categoryFlat = await Category.getFlatList('all');
    } catch (categoryErr) {
      logger.error({ msg: 'cabinet_error', error: categoryErr.message, stack: categoryErr.stack, path: req.path });
      categoryFlat = [];
    }

    const { ensureUserRefCode, REFERRAL_BONUS_ALBA, REFERRED_USER_BONUS } = require('../services/referralService');
    await ensureUserRefCode(freshUser, User);

    const actualBalance = await getUserAlbaBalance(getAuthUserId(req.user));
    freshUser.albaBalance = actualBalance;

    const { formatAlbaTransactions } = require('../utils/albaLabels');
    const userIdNum = parseInt(String(getAuthUserId(req.user)), 10);
    const albaTxRows = await AlbaTransaction.findAll({
      where: { userId: Number.isFinite(userIdNum) ? userIdNum : getAuthUserId(req.user) },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    const albaTransactions = formatAlbaTransactions(albaTxRows);

    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : '');
    const userPayload = freshUser.get ? freshUser.get({ plain: true }) : freshUser;
    userPayload.albaBalance = actualBalance;
    userPayload.accountType = userPayload.accountType || 'showcase';
    userPayload.isShowcaseAccount = userPayload.accountType !== 'services';

    res.render("cabinet", {
      user: userPayload,
      albaTransactions,
      products: myProducts,
      services: myServices || [],
      csrfToken: csrfTokenValue,
      socket_io_available: res.locals.socket_io_available,
      categories: categoryFlat,
      hierarchicalCategories: typeof req.t === 'function'
        ? translateTree(categoryTree, req.t.bind(req))
        : categoryTree,
      referralBonusAlba: REFERRAL_BONUS_ALBA,
      referredUserBonusAlba: REFERRED_USER_BONUS
    });
  } catch (err) {
    logger.error({ msg: 'cabinet_error', error: err.message, stack: err.stack, path: req.path });
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка загрузки кабинета: " + publicErrorMessage(err, "внутренняя ошибка") });
    res.status(500).send("Ошибка загрузки кабинета");
  }
});

router.get("/rules", conditionalCsrfToken, requireUser, (req, res) => {
  const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : "");
  res.render("publication-rules", {
    user: req.user,
    csrfToken: csrfTokenValue
  });
});

// Пользователь создаёт карточку
// Предпросмотр автоперевода полей карточки (до модерации)
router.post("/product/preview-translations", requireUser, productLimiter, conditionalCsrfProtection, async (req, res) => {
  try {
    const { buildCardTranslations } = require("../services/cardTranslationService");
    const sourceLocale = req.body.sourceLocale || req.locale || res.locals.locale || "en";
    const result = await buildCardTranslations(
      {
        name: req.body.name,
        description: req.body.description,
        price: req.body.price,
        tags: req.body.tags,
        contact_method: req.body.contact_method
      },
      sourceLocale
    );
    return res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ msg: "cabinet_preview_translations", error: err.message });
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Не удалось подготовить перевод"
    });
  }
});

router.post("/product", requireUser, productLimiter, mobileOptimization, upload, handleMulterError, conditionalCsrfProtection, validateProduct, async (req, res) => {
  if (!USE_POSTGRES) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    if (!getAuthUserId(req.user)) {
      const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
      if (wantsJson) return res.status(401).json({ success: false, message: 'Необходима авторизация' });
      return res.redirect('/user/login');
    }

    const { sanitizeCloudinaryImageUrls } = require("../services/cloudinaryDirect");
    const imageUrls = sanitizeCloudinaryImageUrls(req.body.image_urls);
    if ((!req.files || req.files.length === 0) && imageUrls.length === 0) {
      return res.status(400).json({ success: false, message: "Необходимо загрузить хотя бы одно изображение" });
    }

    try {
      assertCanCreateCardType(req.user.accountType, req.body.type || allowedCardType(req.user.accountType));
    } catch (typeErr) {
      return sendAccountTypeError(req, res, typeErr);
    }

    const productData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      currency: req.body.currency,
      link: req.body.link,
      video_url: req.body.video_url,
      category: req.body.category,
      type: req.body.type,
      phone: req.body.phone,
      email: req.body.email,
      telegram: req.body.telegram,
      whatsapp: req.body.whatsapp,
      contact_method: req.body.contact_method,
      country: req.body.country,
      region: req.body.region,
      city: req.body.city,
      tags: req.body.tags,
      sourceLocale: req.body.sourceLocale || req.locale || res.locals.locale || "en",
      translations: (() => {
        try {
          if (!req.body.translations) return null;
          return typeof req.body.translations === "string"
            ? JSON.parse(req.body.translations)
            : req.body.translations;
        } catch (_) {
          return null;
        }
      })(),
      ownerId: getAuthUserId(req.user),
      status: "pending",
      image_urls: imageUrls
    };

    console.log(`📋 Creating product: device=${req.isMobile ? 'mobile' : 'desktop'}, filesCount=${req.files ? req.files.length : 0}`);

    // Use new product creation with entitlement check
    const { createProductWithEntitlementCheck } = require('../services/productService');
    const result = await createProductWithEntitlementCheck(productData, req.files || [], req.user);

    const imagesCount = result.product.images?.length || 0;

     console.log("✅ Карточка создана пользователем:", {
       id: String(result.product.id),
       name: result.product.name,
       owner: String(result.product.ownerId || result.product.owner || getAuthUserId(req.user) || ''),
       imagesCount,
       deviceType: req.isMobile ? 'mobile' : 'desktop',
       tier: result.product.tier,
       entitlementConsumed: result.entitlementConsumed
     });

     res.json({
       success: true,
       productId: result.product.id,
      tier: result.product.tier,
      entitlementConsumed: result.entitlementConsumed
    });
  } catch (err) {
    logger.error({ msg: 'cabinet_error', error: err.message, stack: err.stack, path: req.path });
    let message = err.message || 'Ошибка создания карточки';
    if (message.includes('must be verified')) {
      message = 'Подтвердите email, чтобы создавать карточки';
    } else if (message.includes('No available entitlements')) {
      message = 'Нет доступных прав на создание. Купите право в балансе ALBA.';
    } else if (err.status === 400) {
      // keep validation message as-is
    } else if (!message.startsWith('Ошибка')) {
      message = 'Ошибка создания карточки: ' + message;
    }
    res.status(err.status || 500).json({ success: false, message });
  }
});

// Пользователь меняет цену своей карточки
router.post("/product/:id/price", requireUser, conditionalCsrfProtection, validateProductId, async (req, res) => {
  if (!USE_POSTGRES) return res.status(503).json({ success: false, message: "Нет БД" });
   try {
     if (!getAuthUserId(req.user)) {
       const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
       if (wantsJson) return res.status(401).json({ success: false, message: 'Необходима авторизация' });
       return res.redirect('/user/login');
     }

     const { normalizePrice, formatPriceDisplay } = require('../utils/price');
     const { normalizeCurrency, DEFAULT_CURRENCY } = require('../utils/currency');
     let normalized;
     try {
       normalized = normalizePrice(req.body.price);
     } catch (err) {
       return res.status(400).json({ success: false, message: err.message || 'Некорректная цена' });
     }
     let currency = DEFAULT_CURRENCY;
     try {
       if (req.body.currency) currency = normalizeCurrency(req.body.currency);
     } catch (err) {
       return res.status(400).json({ success: false, message: err.message || "Некорректная валюта" });
     }
     
     // Check product ownership
     const productCheck = await Product.findOne({
       where: { id: req.params.id, ownerId: getAuthUserId(req.user), deleted: false }
     });
     if (!productCheck) {
       return res.status(404).json({ success: false, message: "Карточка не найдена" });
     }
     try {
       assertUserCanEditCard(productCheck);
     } catch (editErr) {
       return res.status(editErr.status || 403).json({ success: false, message: editErr.message });
     }

     await Product.update(
       { price: normalized, currency },
       { where: { id: req.params.id } }
     );
     
     res.json({
       success: true,
       price: normalized,
       currency,
       priceDisplay: formatPriceDisplay(normalized, currency)
     });
   } catch (err) {
     logger.error({ msg: 'cabinet_error', error: err.message, stack: err.stack, path: req.path });
     res.status(500).json({ success: false, message: "Ошибка изменения цены" });
   }
});

// Получение формы редактирования товара
router.get("/product/:id/edit", requireUser, validateProductId, conditionalCsrfToken, async (req, res) => {
  if (!USE_POSTGRES) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });
    return res.status(503).send("Недоступно: отсутствует подключение к БД");
  }
  try {
    if (!getAuthUserId(req.user)) {
      const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
      if (wantsJson) return res.status(401).json({ success: false, message: 'Необходима авторизация' });
      return res.redirect('/user/login');
    }

     const product = await Product.findOne({
       where: { id: req.params.id, ownerId: getAuthUserId(req.user), deleted: false }
     });
    if (!product) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) return res.status(404).json({ success: false, message: "Карточка не найдена или у вас нет прав для редактирования" });
      return res.status(404).send("Карточка не найдена или у вас нет прав для редактирования");
    }

    try {
      assertCanCreateCardType(req.user.accountType, product.type === 'service' ? 'service' : 'product');
    } catch (typeErr) {
      return sendAccountTypeError(req, res, typeErr);
    }

    if (!canUserEditCard(product)) {
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      const message = "Бесплатное редактирование доступно 24 часа после одобрения. Дальше — только новая карточка.";
      if (wantsJson) return res.status(403).json({ success: false, message });
      return res.status(403).send(message);
    }

    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || (req.csrfToken ? req.csrfToken() : null);

    res.render("products/edit", {
      product,
      user: req.user,
      mode: "user",
      csrfToken: csrfTokenValue,
      hierarchicalCategories: typeof req.t === 'function'
        ? localizeHierarchicalCategories(req.t.bind(req))
        : undefined
    });
  } catch (err) {
    logger.error({ msg: 'cabinet_error', error: err.message, stack: err.stack, path: req.path });
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(500).json({ success: false, message: "Ошибка базы данных: " + publicErrorMessage(err, "внутренняя ошибка") });
    res.status(500).send("Ошибка базы данных");
  }
});

// Редактирование товара пользователем
router.post("/product/:id/edit", requireUser, productLimiter, mobileOptimization, upload, handleMulterError, conditionalCsrfProtection, validateProductId, validateProduct, async (req, res) => {
  if (!USE_POSTGRES) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    if (!getAuthUserId(req.user)) {
      const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
      if (wantsJson) return res.status(401).json({ success: false, message: 'Необходима авторизация' });
      return res.redirect('/user/login');
    }

    try {
      assertCanCreateCardType(req.user.accountType, req.body.type || allowedCardType(req.user.accountType));
    } catch (typeErr) {
      return sendAccountTypeError(req, res, typeErr);
    }

    const updateData = {
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      currency: req.body.currency,
      link: req.body.link,
      video_url: req.body.video_url,
      category: req.body.category,
      type: allowedCardType(req.user.accountType),
      phone: req.body.phone,
      email: req.body.email,
      telegram: req.body.telegram,
      whatsapp: req.body.whatsapp,
      contact_method: req.body.contact_method,
      country: req.body.country,
      region: req.body.region,
      city: req.body.city,
      tags: req.body.tags,
      sourceLocale: req.body.sourceLocale || req.locale || res.locals.locale || "en",
      translations: (() => {
        try {
          if (!req.body.translations) return null;
          return typeof req.body.translations === "string"
            ? JSON.parse(req.body.translations)
            : req.body.translations;
        } catch (_) {
          return null;
        }
      })(),
      current_images: req.body.current_images,
      image_urls: req.body.image_urls
    };

    const updated = await updateProduct(
      req.params.id,
      updateData,
      req.files || [],
      { ownerId: getAuthUserId(req.user) }
    );
    
     console.log("✅ Карточка обновлена пользователем:", {
       id: String(updated.id),
       name: updated.name,
       owner: String(updated.ownerId || updated.owner || getAuthUserId(req.user) || '')
     });
    
    // Проверяем, является ли запрос AJAX
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ success: true, product: updated });
    }
     // Перенаправляем на страницу редактирования
     res.redirect(`/cabinet/product/${updated.id}/edit`);
  } catch (err) {
    logger.error({ msg: 'cabinet_error', error: err.message, stack: err.stack, path: req.path });
    if (err.code === 'EDIT_WINDOW' || err.code === 'PUBLICATION_EXPIRED') {
      return res.status(err.status || 403).json({ success: false, message: err.message });
    }
    if (err.message.includes("не найден") || err.message.includes("нет прав")) {
      return res.status(404).json({ success: false, message: err.message });
    }
    res.status(500).json({ success: false, message: "Ошибка редактирования карточки: " + publicErrorMessage(err, "внутренняя ошибка") });
  }
});

// Удаление товара/услуги пользователем
router.delete("/product/:id", requireUser, conditionalCsrfProtection, async (req, res) => {
  if (!USE_POSTGRES) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    if (!getAuthUserId(req.user)) {
      const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
      if (wantsJson) return res.status(401).json({ success: false, message: 'Необходима авторизация' });
      return res.redirect('/user/login');
    }

     const product = await Product.findOne({
       where: { id: req.params.id, ownerId: getAuthUserId(req.user), deleted: false }
     });
    if (!product) {
      return res.status(404).json({ success: false, message: "Карточка не найдена или у вас нет прав для удаления" });
    }

    try {
      assertCanCreateCardType(req.user.accountType, product.type === 'service' ? 'service' : 'product');
    } catch (typeErr) {
      return sendAccountTypeError(req, res, typeErr);
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
           'ID карточки': product.id.toString(),
          'Название': product.name,
          'Тип': product.type || 'product',
          'Владелец': String(product.ownerId || getAuthUserId(req.user) || 'Неизвестен'),
          'Дата удаления': new Date().toLocaleString('ru-RU')
        }
      );
    } catch (notificationError) {
      logger.error({ msg: 'cabinet_error', error: notificationError.message, stack: notificationError.stack, path: req.path });
    }

    res.json({ success: true, message: "Карточка удалена" });
  } catch (err) {
    logger.error({ msg: 'cabinet_error', error: err.message, stack: err.stack, path: req.path });
    res.status(500).json({ success: false, message: "Ошибка удаления карточки: " + publicErrorMessage(err, "внутренняя ошибка") });
  }
});

router.post("/product/:id/republish", requireUser, conditionalCsrfProtection, validateProductId, async (req, res) => {
  if (!USE_POSTGRES) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    const userId = getAuthUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Необходима авторизация" });
    }
    const result = await republishCard({
      productId: req.params.id,
      userId,
      type: allowedCardType(req.user.accountType)
    });
    return res.json({
      success: true,
      productId: result.product.id,
      message: "Карточка отправлена на модерацию как новая платная публикация"
    });
  } catch (err) {
    logger.error({ msg: 'cabinet_republish', error: err.message, stack: err.stack, path: req.path });
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Не удалось продлить публикацию"
    });
  }
});

router.post("/product/:id/auto-renew", requireUser, conditionalCsrfProtection, validateProductId, async (req, res) => {
  if (!USE_POSTGRES) return res.status(503).json({ success: false, message: "Нет БД" });
  try {
    const userId = getAuthUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Необходима авторизация" });
    }
    const enabled = req.body && (
      req.body.enabled === true
      || req.body.enabled === "true"
      || req.body.enabled === 1
      || req.body.enabled === "1"
    );
    const result = await setCardAutoRenew({
      productId: req.params.id,
      userId,
      enabled
    });
    return res.json({
      success: true,
      autoRenew: result.autoRenew,
      renewed: result.renewed
    });
  } catch (err) {
    logger.error({ msg: 'cabinet_auto_renew', error: err.message, stack: err.stack, path: req.path });
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || "Не удалось сохранить автопродление"
    });
  }
});

// Полное удаление своего аккаунта и всех данных пользователя
router.post("/delete-account", conditionalCsrfProtection, requireUser, async (req, res) => {
  const bcrypt = require("bcryptjs");
  const { deleteOwnAccount } = require("../services/userAdminService");
  const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
  try {
    const userId = getAuthUserId(req.user);
    if (!userId) {
      const msg = "Необходима авторизация";
      if (wantsJson) return res.status(401).json({ success: false, message: msg });
      return res.status(401).send(msg);
    }
    const password = String(req.body?.password || "");
    const confirm = String(req.body?.confirm || "");
    if (confirm !== "DELETE" && confirm !== "УДАЛИТЬ") {
      const msg = "Подтвердите удаление: введите DELETE";
      if (wantsJson) return res.status(400).json({ success: false, message: msg });
      return res.status(400).redirect("/cabinet?deleteError=1");
    }
    const user = await User.findByPk(userId);
    if (!user) {
      const msg = "Пользователь не найден";
      if (wantsJson) return res.status(404).json({ success: false, message: msg });
      return res.status(404).redirect("/user/login");
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      const msg = "Неверный пароль";
      if (wantsJson) return res.status(400).json({ success: false, message: msg });
      return res.status(400).redirect("/cabinet?deleteError=password");
    }
    await deleteOwnAccount(userId);

    res.clearCookie("exto_token");
    res.clearCookie("exto_user");
    if (req.session && typeof req.session.destroy === "function") {
      req.session.destroy(() => {});
    }

    if (wantsJson) {
      return res.json({ success: true, redirect: "/" });
    }
    return res.redirect("/?accountDeleted=1");
  } catch (err) {
    logger.error({ msg: "cabinet_delete_account", error: err.message, stack: err.stack });
    const msg = err.message || "Не удалось удалить аккаунт";
    if (wantsJson) return res.status(err.status || 500).json({ success: false, message: msg });
    return res.status(err.status || 500).redirect("/cabinet?deleteError=1");
  }
});

module.exports = router;
