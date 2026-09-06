const logger = require("../utils/logger");
const { Product, User, USE_POSTGRES } = require("../config/database");
const bcrypt = require("bcryptjs");
const { loginLimiter, registerLimiter, apiLimiter, contactLimiter, productLimiter } = require("../middleware/rateLimiter");
const { validateRegister, validateProductId, validateProduct } = require("../middleware/validators");
const { requireUser, requireAdmin, getAuthUserId } = require("../middleware/auth");
const { parsePagination } = require("../utils/pagination");
const { publicProductWhere, publicServiceWhere } = require("../utils/catalogFilters");
const { buildCatalogFilters, mergeWhere } = require("../utils/catalogSearch");
const { isLive, publicationFieldsOnApprove } = require("../utils/cardPublication");
const { serializeMobileCard, serializeMobileUser } = require("../utils/mobileSerialize");
const { performRegister, resolveUser } = require("../controllers/authController");
const { castVote } = require("../services/voteService");
const { expirePublishedCards, setCardAutoRenew, republishCard } = require("../services/cardPublicationService");
const {
  getUserAlbaBalance,
  listTransactions,
  refundAlbaOnModerationReject,
  purchaseEntitlement,
  getAvailableEntitlements,
  grantAlbaByUsername,
  ENTITLEMENT_COST_ALBA
} = require("../services/albaService");
const { isValidEntityId } = require("../utils/idValidation");
const Comment = require("../models/Comment");
const { serializeComment } = require("../utils/commentSerialize");
const { canViewCardDiscussion } = require("../middleware/comments");
const { getFaqDoc } = require("../utils/faqDoc");
const { resendVerificationEmail } = require("../services/emailVerificationService");
const { upload, mobileOptimization } = require("../utils/upload");
const { allowedCardType } = require("../utils/accountType");
const { resolveRequestLocale, SUPPORTED, initI18n } = require("../middleware/i18n");
const express = require("express");
const crypto = require("crypto");

const router = express.Router();

function mobileLocale(req) {
  const header = String(req.get("x-locale") || req.get("X-Locale") || "").toLowerCase().slice(0, 2);
  if (SUPPORTED.includes(header)) return header;
  const q = String(req.query.lang || "").toLowerCase();
  if (SUPPORTED.includes(q)) return q;
  return resolveRequestLocale(req);
}

function handleMulterError(err, req, res, next) {
  if (!err) return next();
  logger.error({ msg: "mobile_upload_error", error: err.message, code: err.code });
  if (err.code === "LIMIT_FILE_COUNT") {
    return fail(res, 400, "Максимальное количество изображений: 5");
  }
  if (err.code === "LIMIT_FILE_SIZE") {
    return fail(res, 400, "Размер файла превышает 5MB");
  }
  return fail(res, 400, "Ошибка загрузки файлов: " + (err.message || "Неизвестная ошибка"));
}

function mapCardFields(body = {}) {
  return {
    name: body.name,
    description: body.description,
    price: body.price,
    currency: body.currency,
    link: body.link,
    video_url: body.video_url,
    category: body.category || body.categoryId,
    type: body.type,
    phone: body.phone,
    email: body.email,
    telegram: body.telegram,
    whatsapp: body.whatsapp,
    contact_method: body.contact_method,
    country: body.country,
    region: body.region,
    city: body.city,
    tags: body.tags,
    sourceLocale: body.sourceLocale || body.source_locale,
    translations: body.translations,
    current_images: body.current_images,
    image_urls: body.image_urls
  };
}

function createCardErrorMessage(err) {
  let message = err.message || "Ошибка создания карточки";
  if (message.includes("must be verified")) {
    return "Подтвердите email, чтобы создавать карточки";
  }
  if (message.includes("No available entitlements") || message.includes("No available entitlements found")) {
    return "Нет доступных прав на создание. Купите право в балансе ALBA.";
  }
  return message;
}

function dbUnavailable(res) {
  return res.status(503).json({ success: false, message: "Недоступно: нет БД" });
}

function fail(res, status, message, extras = {}) {
  return res.status(status).json({ success: false, message, ...extras });
}

function guestKeyFromRequest(req) {
  const header = req.get && (req.get("x-guest-id") || req.get("X-Guest-Id"));
  const raw = String(header || (req.body && req.body.guestKey) || req.cookies?.guestId || "").trim();
  if (raw.length >= 16) return raw.slice(0, 64);
  return crypto.randomBytes(18).toString("hex");
}

async function listCatalog(req, res, kind) {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const { page, limit, offset } = parsePagination(req.query);
    const { extras, order } = buildCatalogFilters(req.query);
    const categoryId = parseInt(req.query.categoryId, 10);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      extras.push({ categoryId });
    }
    const base = kind === "service" ? publicServiceWhere() : publicProductWhere();
    const where = mergeWhere(base, extras);
    const { rows, count } = await Product.findAndCountAll({
      where,
      include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
      order: order && order.length ? order : [["id", "DESC"]],
      limit,
      offset,
      distinct: true
    });
    const items = rows.map((row) => serializeMobileCard(row));
    return res.json({
      success: true,
      items,
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit))
    });
  } catch (err) {
    logger.error({ msg: "mobile_catalog_error", kind, error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
}

router.get("/v1/health", (req, res) => {
  res.json({ success: true, name: "albamount-mobile", version: 3 });
});

router.get("/v1/meta/categories", apiLimiter, async (req, res) => {
  try {
    await initI18n();
    const i18next = require("i18next");
    const lng = mobileLocale(req);
    const t = i18next.getFixedT(lng);
    const type = String(req.query.type || "all");
    const Category = require("../config/database").Category;
    const tree = await Category.getTree(type, false);
    const { translateTree } = require("../utils/categoryI18n");
    return res.json({
      success: true,
      locale: lng,
      categories: translateTree(tree || [], t)
    });
  } catch (err) {
    logger.error({ msg: "mobile_categories", error: err.message });
    return fail(res, 500, "Ошибка загрузки категорий");
  }
});

router.get("/v1/meta/locations", apiLimiter, (req, res) => {
  try {
    const { getCountries, getCities } = require("../data/locations");
    const lng = mobileLocale(req);
    const country = String(req.query.country || "").trim();
    if (country) {
      return res.json({ success: true, locale: lng, cities: getCities(country, "", lng) });
    }
    return res.json({ success: true, locale: lng, countries: getCountries(lng) });
  } catch (err) {
    logger.error({ msg: "mobile_locations", error: err.message });
    return fail(res, 500, "Ошибка загрузки локаций");
  }
});

router.get("/v1/meta/suggest-tags", apiLimiter, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase().replace(/^#/, "");
    if (!USE_POSTGRES || q.length < 1) {
      return res.json({ success: true, tags: [] });
    }
    const [rows] = await require("../config/database").sequelize.query(
      `SELECT DISTINCT unnest(tags) AS tag
       FROM products
       WHERE deleted = false AND status = 'approved'
         AND EXISTS (
           SELECT 1 FROM unnest(tags) t WHERE lower(t) LIKE :like
         )
       LIMIT 20`,
      { replacements: { like: `%${q}%` } }
    );
    return res.json({
      success: true,
      tags: (rows || []).map((r) => String(r.tag || "")).filter(Boolean)
    });
  } catch (err) {
    logger.error({ msg: "mobile_suggest_tags", error: err.message });
    return res.json({ success: true, tags: [] });
  }
});

router.post("/v1/auth/login", loginLimiter, async (req, res) => {
  const username = String(req.body && (req.body.username || req.body.login) || "").trim();
  const password = req.body && req.body.password;
  if (!username || !password) {
    return fail(res, 400, "Введите логин и пароль");
  }

  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const user = await User.findOne({ where: { username } });
    if (!user) {
      logger.warn({ msg: "mobile_login_failed", reason: "user_not_found", username });
      return fail(res, 401, "Неверный логин или пароль");
    }
    if (user.role !== "admin" && !user.emailVerified) {
      return fail(res, 403, "Подтвердите email перед входом", {
        showResendVerification: true,
        email: user.email
      });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      logger.warn({ msg: "mobile_login_failed", reason: "invalid_password", userId: user.id });
      return fail(res, 401, "Неверный логин или пароль");
    }

    const resolved = await resolveUser(user.id);
    if (!resolved) return fail(res, 401, "Неверный логин или пароль");

    logger.info({ msg: "mobile_login_success", userId: user.id, username: user.username });
    return res.json({
      success: true,
      token: resolved.token,
      user: serializeMobileUser(resolved.user)
    });
  } catch (err) {
    logger.error({ msg: "mobile_login_error", error: err.message });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.post("/v1/auth/register", registerLimiter, validateRegister, async (req, res) => {
  try {
    const result = await performRegister(req);
    if (!result.body || !result.body.success) {
      return res.status(result.status).json(result.body);
    }

    const payload = { ...result.body };
    if (payload.user && payload.user.emailVerified) {
      const resolved = await resolveUser(payload.user.id);
      if (resolved) {
        payload.token = resolved.token;
        payload.user = serializeMobileUser(resolved.user);
      }
    }
    return res.status(result.status).json(payload);
  } catch (err) {
    logger.error({ msg: "mobile_register_error", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка регистрации");
  }
});

router.post("/v1/auth/logout", (req, res) => {
  res.json({ success: true, message: "Вы вышли" });
});

router.post("/v1/auth/resend-verification", loginLimiter, async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!email) return fail(res, 400, "Укажите email");
    await resendVerificationEmail(email, req.locale || "ru");
    return res.json({
      success: true,
      message: "Письмо с подтверждением отправлено повторно. Проверьте почту."
    });
  } catch (err) {
    logger.error({ msg: "mobile_resend_verification", error: err.message });
    return res.json({
      success: true,
      message: "Письмо с подтверждением отправлено повторно. Проверьте почту."
    });
  }
});

router.get("/v1/faq", apiLimiter, (req, res) => {
  const lang = String(req.query.lang || req.locale || "ru").slice(0, 5);
  const doc = getFaqDoc(lang);
  const items = [];
  for (const group of doc.groups || []) {
    const category = group.title || group.name || "";
    for (const item of group.items || []) {
      if (!item || !item.q || !item.a) continue;
      items.push({
        id: String(item.id || `${items.length + 1}`),
        question: item.q,
        answer: item.a,
        category
      });
    }
  }
  return res.json({ success: true, items });
});

router.get("/v1/me", requireUser, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const userId = getAuthUserId(req.user);
    const resolved = await resolveUser(userId, false);
    if (!resolved) return fail(res, 401, "Требуется авторизация");
    const balance = await getUserAlbaBalance(userId);
    return res.json({
      success: true,
      user: serializeMobileUser(resolved.user),
      albaBalance: balance
    });
  } catch (err) {
    logger.error({ msg: "mobile_me_error", error: err.message });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.get("/v1/catalog/services", apiLimiter, (req, res) => listCatalog(req, res, "service"));
router.get("/v1/catalog/ads", apiLimiter, (req, res) => listCatalog(req, res, "product"));

router.get("/v1/cards/:id", apiLimiter, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const product = await Product.findOne({
      where: { id: req.params.id, deleted: false },
      include: [{ model: User, as: "owner", attributes: ["id", "username"] }]
    });
    if (!product) return fail(res, 404, "Карточка не найдена");

    const isAdmin = req.user && req.user.role === "admin";
    const ownerMatch = req.user && String(product.ownerId) === String(getAuthUserId(req.user));
    if (!isLive(product) && !isAdmin && !ownerMatch) {
      return fail(res, 404, "Карточка не найдена");
    }

    return res.json({
      success: true,
      card: serializeMobileCard(product, { includeOwnerFields: Boolean(isAdmin || ownerMatch) })
    });
  } catch (err) {
    logger.error({ msg: "mobile_card_error", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.post("/v1/cards/:id/vote", apiLimiter, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const vote = req.body && req.body.vote;
    if (vote !== "up" && vote !== "down") {
      return fail(res, 400, "Неверное значение vote. Используйте 'up' или 'down'");
    }
    const product = await Product.findOne({ where: { id: req.params.id, deleted: false } });
    if (!product || !isLive(product)) return fail(res, 404, "Карточка не найдена");

    const user = req.user || null;
    const guestKey = user ? null : guestKeyFromRequest(req);
    const result = await castVote({
      targetType: product.type === "service" ? "service" : "product",
      targetId: req.params.id,
      vote,
      user,
      guestKey
    });
    if (!result.ok) {
      return fail(res, result.status || 500, result.message || "Не удалось проголосовать");
    }
    if (!user && guestKey) {
      res.setHeader("X-Guest-Id", guestKey);
    }
    return res.json({
      success: true,
      likes: result.likes,
      dislikes: result.dislikes,
      rating: result.result,
      totalVotes: result.total,
      voted: true
    });
  } catch (err) {
    logger.error({ msg: "mobile_vote_error", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.get("/v1/cards/:id/comments", apiLimiter, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    if (!isValidEntityId(req.params.id)) {
      return fail(res, 400, "Некорректный ID карточки");
    }
    const card = await Product.findByPk(req.params.id);
    if (!card) return fail(res, 404, "Карточка не найдена");
    if (!canViewCardDiscussion(card, req.user)) {
      return fail(res, 403, "Комментарии доступны только для опубликованных карточек");
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const comments = await Comment.getCommentsByCard(req.params.id, null, page, limit);
    const total = await Comment.getCommentCount(req.params.id);
    return res.json({
      success: true,
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit) || 1)
      }
    });
  } catch (err) {
    logger.error({ msg: "mobile_comments_error", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.post("/v1/cards/:id/comments", apiLimiter, requireUser, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const text = req.body && req.body.text;
    if (!text || typeof text !== "string" || text.trim().length < 1 || text.trim().length > 1000) {
      return fail(res, 400, "Текст комментария должен быть от 1 до 1000 символов");
    }
    const card = await Product.findByPk(req.params.id);
    if (!card) return fail(res, 404, "Карточка не найдена");
    if (!isLive(card)) {
      return fail(res, 403, "Комментарии доступны только для опубликованных карточек");
    }

    const comment = await Comment.create({
      cardId: req.params.id,
      cardType: card.type === "service" ? "Service" : "Product",
      userId: getAuthUserId(req.user),
      text: text.trim()
    });
    const author = await User.findByPk(getAuthUserId(req.user), { attributes: ["id", "username"] });
    const payload = serializeComment(comment, {
      user: author,
      username: author && author.username,
      cardId: req.params.id
    });
    return res.status(201).json({
      success: true,
      comment: payload,
      message: "Комментарий добавлен"
    });
  } catch (err) {
    logger.error({ msg: "mobile_comment_create_error", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.get("/v1/cabinet/cards", requireUser, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const userId = getAuthUserId(req.user);
    try {
      await expirePublishedCards({ ownerId: userId });
    } catch (expireErr) {
      logger.warn({ msg: "mobile_expire_cards", error: expireErr.message });
    }

    const accountType = (req.user && req.user.accountType) || "showcase";
    const { Op } = require("sequelize");
    const ownerWhere = accountType === "services"
      ? { ownerId: userId, deleted: false, type: "service" }
      : {
          ownerId: userId,
          deleted: false,
          [Op.or]: [{ type: "product" }, { type: null }]
        };

    const rows = await Product.findAll({
      where: ownerWhere,
      order: [["id", "DESC"]]
    });
    return res.json({
      success: true,
      items: rows.map((row) => serializeMobileCard(row, { includeOwnerFields: true }))
    });
  } catch (err) {
    logger.error({ msg: "mobile_cabinet_error", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.post("/v1/cabinet/cards/:id/auto-renew", requireUser, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const userId = getAuthUserId(req.user);
    const enabled = Boolean(req.body && (
      req.body.enabled === true
      || req.body.enabled === "true"
      || req.body.enabled === 1
      || req.body.enabled === "1"
    ));
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
    logger.error({ msg: "mobile_auto_renew", error: err.message, stack: err.stack });
    return fail(res, err.status || 500, err.message || "Не удалось сохранить автопродление");
  }
});

router.get("/v1/alba", requireUser, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const userId = getAuthUserId(req.user);
    const [balance, transactions] = await Promise.all([
      getUserAlbaBalance(userId),
      listTransactions({ userId, limit: 50 })
    ]);
    return res.json({
      success: true,
      balance,
      transactions
    });
  } catch (err) {
    logger.error({ msg: "mobile_alba_error", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.post("/v1/cabinet/cards/:id/republish", requireUser, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const userId = getAuthUserId(req.user);
    const result = await republishCard({
      productId: req.params.id,
      userId,
      type: req.user.accountType === "services" ? "service" : "product"
    });
    return res.json({
      success: true,
      productId: result.product.id,
      message: "Карточка отправлена на модерацию"
    });
  } catch (err) {
    logger.error({ msg: "mobile_republish", error: err.message });
    return fail(res, err.status || 500, err.message || "Не удалось продлить");
  }
});

router.delete("/v1/cabinet/cards/:id", requireUser, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const userId = getAuthUserId(req.user);
    const product = await Product.findOne({
      where: { id: req.params.id, ownerId: userId, deleted: false }
    });
    if (!product) return fail(res, 404, "Карточка не найдена");
    await product.update({ deleted: true, status: "rejected" });
    return res.json({ success: true, message: "Карточка удалена" });
  } catch (err) {
    logger.error({ msg: "mobile_delete_card", error: err.message });
    return fail(res, 500, "Ошибка удаления");
  }
});

router.get("/v1/admin/pending", requireAdmin, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const rows = await Product.findAll({
      where: { status: "pending", deleted: false },
      include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
      order: [["id", "ASC"]],
      limit: 100
    });
    return res.json({
      success: true,
      items: rows.map((row) => serializeMobileCard(row, { includeOwnerFields: true })),
      total: rows.length
    });
  } catch (err) {
    logger.error({ msg: "mobile_admin_pending", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка сервера");
  }
});

router.get("/v1/admin/cards", requireAdmin, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const { Op } = require("sequelize");
    const type = String(req.query.type || "all");
    const status = String(req.query.status || "").trim();
    const where = { deleted: false };
    if (type === "service") where.type = "service";
    else if (type === "product") where[Op.or] = [{ type: "product" }, { type: null }];
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      where.status = status;
    }
    const rows = await Product.findAll({
      where,
      include: [{ model: User, as: "owner", attributes: ["id", "username"] }],
      order: [["id", "DESC"]],
      limit: Math.min(parseInt(req.query.limit, 10) || 80, 200)
    });
    return res.json({
      success: true,
      items: rows.map((row) => serializeMobileCard(row, { includeOwnerFields: true })),
      total: rows.length
    });
  } catch (err) {
    logger.error({ msg: "mobile_admin_cards", error: err.message });
    return fail(res, 500, "Ошибка загрузки карточек");
  }
});

router.post("/v1/admin/cards/:id/delete", requireAdmin, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const product = await Product.findByPk(req.params.id);
    if (!product || product.deleted) return fail(res, 404, "Карточка не найдена");
    await product.update({ deleted: true, status: "rejected", rejectionReason: "Удалено администратором" });
    return res.json({ success: true, message: "Карточка удалена" });
  } catch (err) {
    logger.error({ msg: "mobile_admin_delete", error: err.message });
    return fail(res, 500, "Ошибка удаления");
  }
});

router.post("/v1/admin/cards/:id/approve", requireAdmin, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const product = await Product.findByPk(req.params.id);
    if (!product || product.deleted) return fail(res, 404, "Карточка не найдена");
    const type = product.type === "service" ? "service" : (product.type || "product");
    await Product.update(
      { ...publicationFieldsOnApprove(product), type },
      { where: { id: product.id } }
    );
    await product.reload();
    return res.json({
      success: true,
      id: product.id,
      status: product.status,
      message: "Одобрено"
    });
  } catch (err) {
    logger.error({ msg: "mobile_admin_approve", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка одобрения");
  }
});

router.post("/v1/admin/cards/:id/reject", requireAdmin, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const reason = String((req.body && (req.body.reason || req.body.rejectionReason)) || "Несоответствие правилам").trim();
    const product = await Product.findByPk(req.params.id);
    if (!product || product.deleted) return fail(res, 404, "Карточка не найдена");
    const wasPending = product.status === "pending";
    const shouldRefund = wasPending && product.tier === "paid";
    await Product.update(
      {
        status: "rejected",
        rejectionReason: reason,
        adminComment: "Отклонено из приложения"
      },
      { where: { id: product.id } }
    );
    await product.reload();
    if (shouldRefund) {
      try {
        await refundAlbaOnModerationReject({
          card: product,
          actorAdminId: getAuthUserId(req.user)
        });
      } catch (refundErr) {
        logger.warn({ msg: "mobile_admin_reject_refund", error: refundErr.message });
      }
    }
    return res.json({
      success: true,
      id: product.id,
      status: product.status,
      message: "Отклонено"
    });
  } catch (err) {
    logger.error({ msg: "mobile_admin_reject", error: err.message, stack: err.stack });
    return fail(res, 500, "Ошибка отклонения");
  }
});

router.post(
  "/v1/cabinet/cards",
  requireUser,
  productLimiter,
  mobileOptimization,
  upload,
  handleMulterError,
  validateProduct,
  async (req, res) => {
    try {
      if (!USE_POSTGRES) return dbUnavailable(res);
      const { sanitizeCloudinaryImageUrls } = require("../services/cloudinaryDirect");
      const imageUrls = sanitizeCloudinaryImageUrls(req.body.image_urls);
      if ((!req.files || req.files.length === 0) && imageUrls.length === 0) {
        return fail(res, 400, "Необходимо загрузить хотя бы одно изображение");
      }
      const { createProductWithEntitlementCheck } = require("../services/productService");
      const productData = {
        ...mapCardFields(req.body),
        ownerId: getAuthUserId(req.user),
        status: "pending",
        image_urls: imageUrls,
        type: allowedCardType(req.user.accountType)
      };
      const result = await createProductWithEntitlementCheck(productData, req.files || [], req.user);
      return res.json({
        success: true,
        productId: result.product.id,
        card: serializeMobileCard(result.product, { includeOwnerFields: true }),
        tier: result.product.tier,
        entitlementConsumed: result.entitlementConsumed,
        message: "Карточка отправлена на модерацию"
      });
    } catch (err) {
      logger.error({ msg: "mobile_create_card", error: err.message, stack: err.stack });
      return fail(res, err.status || 500, createCardErrorMessage(err));
    }
  }
);

router.post(
  "/v1/cabinet/cards/:id",
  requireUser,
  productLimiter,
  mobileOptimization,
  upload,
  handleMulterError,
  validateProductId,
  validateProduct,
  async (req, res) => {
    try {
      if (!USE_POSTGRES) return dbUnavailable(res);
      const { updateProduct } = require("../services/productService");
      const updateData = {
        ...mapCardFields(req.body),
        type: allowedCardType(req.user.accountType)
      };
      const updated = await updateProduct(
        req.params.id,
        updateData,
        req.files || [],
        { ownerId: getAuthUserId(req.user) }
      );
      return res.json({
        success: true,
        card: serializeMobileCard(updated, { includeOwnerFields: true }),
        message: "Карточка обновлена и снова на модерации"
      });
    } catch (err) {
      logger.error({ msg: "mobile_update_card", error: err.message, stack: err.stack });
      if (err.code === "EDIT_WINDOW" || err.code === "PUBLICATION_EXPIRED") {
        return fail(res, err.status || 403, err.message);
      }
      return fail(res, err.status || 500, err.message || "Ошибка редактирования");
    }
  }
);

router.get("/v1/entitlements", requireUser, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const userId = getAuthUserId(req.user);
    const entitlements = await getAvailableEntitlements(userId);
    const type = allowedCardType(req.user.accountType);
    const available = entitlements.filter((e) => e.type === type);
    return res.json({
      success: true,
      cost: ENTITLEMENT_COST_ALBA,
      type,
      available: available.length,
      entitlements: available
    });
  } catch (err) {
    logger.error({ msg: "mobile_entitlements", error: err.message });
    return fail(res, 500, "Ошибка прав");
  }
});

router.post("/v1/entitlements/purchase", requireUser, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const type = allowedCardType(req.user.accountType);
    const idempotencyKey = String(req.body?.idempotencyKey || crypto.randomUUID());
    const result = await purchaseEntitlement({
      UserModel: User,
      userId: getAuthUserId(req.user),
      type,
      idempotencyKey
    });
    if (!result.ok) {
      return fail(res, result.status || 400, result.message || "Не удалось купить право");
    }
    const balance = await getUserAlbaBalance(getAuthUserId(req.user));
    return res.json({
      success: true,
      balance,
      cost: ENTITLEMENT_COST_ALBA,
      message: "Право куплено"
    });
  } catch (err) {
    logger.error({ msg: "mobile_entitlement_purchase", error: err.message });
    return fail(res, 500, err.message || "Ошибка покупки права");
  }
});

router.get("/v1/admin/contacts", requireAdmin, async (req, res) => {
  try {
    const { listContactMessages } = require("../services/contactMessageService");
    const messages = await listContactMessages();
    return res.json({ success: true, items: messages || [] });
  } catch (err) {
    logger.error({ msg: "mobile_admin_contacts", error: err.message });
    return fail(res, 500, "Ошибка загрузки сообщений");
  }
});

router.post("/v1/admin/contacts/:id/read", requireAdmin, async (req, res) => {
  try {
    const { sequelize } = require("../config/database");
    const { QueryTypes } = require("sequelize");
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return fail(res, 400, "Некорректный id");
    const [updated] = await sequelize.query(
      `UPDATE contact_messages SET is_read = true, updated_at = NOW() WHERE id = :id RETURNING id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!updated) return fail(res, 404, "Сообщение не найдено");
    return res.json({ success: true, message: "Прочитано" });
  } catch (err) {
    return fail(res, 500, "Ошибка");
  }
});

router.post("/v1/admin/cards/:id/toggle-visibility", requireAdmin, validateProductId, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const product = await Product.findByPk(req.params.id);
    if (!product) return fail(res, 404, "Карточка не найдена");
    const newStatus = product.status === "approved" ? "rejected" : "approved";
    const patch = newStatus === "approved"
      ? { ...publicationFieldsOnApprove(product), type: product.type || "product" }
      : { status: "rejected", rejectionReason: "Заблокировано администратором" };
    await product.update(patch);
    return res.json({
      success: true,
      id: product.id,
      status: newStatus,
      message: newStatus === "rejected" ? "Карточка заблокирована" : "Карточка разблокирована"
    });
  } catch (err) {
    logger.error({ msg: "mobile_admin_toggle", error: err.message });
    return fail(res, 500, "Ошибка блокировки");
  }
});

router.post("/v1/admin/alba/grant", requireAdmin, async (req, res) => {
  try {
    if (!USE_POSTGRES) return dbUnavailable(res);
    const login = String(req.body?.login || req.body?.username || "").trim();
    const amount = Number(req.body?.amount);
    const reason = String(req.body?.reason || "admin_grant").trim() || "admin_grant";
    if (!login || !Number.isFinite(amount) || amount === 0) {
      return fail(res, 400, "Укажите логин и сумму");
    }
    const result = await grantAlbaByUsername(
      login,
      amount,
      reason,
      getAuthUserId(req.user),
      String(req.body?.comment || "")
    );
    return res.json({ success: true, message: "ALBA начислены", balance: result.balance });
  } catch (err) {
    logger.error({ msg: "mobile_admin_grant", error: err.message });
    return fail(res, 500, err.message || "Ошибка начисления");
  }
});

router.post("/v1/contact", contactLimiter, async (req, res) => {
  req.headers.accept = "application/json";
  return require("../controllers/contactController").sendContactMessage(req, res);
});

module.exports = router;
