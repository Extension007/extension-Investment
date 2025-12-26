// Валидаторы для express-validator
const { body, param, query, validationResult } = require("express-validator");
const { CATEGORY_KEYS } = require("../config/constants");

// Middleware для обработки ошибок валидации
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(400).json({ 
        success: false, 
        message: "Ошибка валидации",
        errors: errors.array()
      });
    }
    // Для HTML форм возвращаем ошибку
    return res.status(400).send("Ошибка валидации: " + errors.array().map(e => e.msg).join(", "));
  }
  next();
}

// Валидация создания/редактирования товара
const validateProduct = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Название товара обязательно")
    .isLength({ min: 1, max: 200 })
    .withMessage("Название должно быть от 1 до 200 символов"),
  
  body("price")
    .notEmpty()
    .withMessage("Цена обязательна")
    .isFloat({ min: 0 })
    .withMessage("Цена должна быть положительным числом"),
  
  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Описание не должно превышать 5000 символов"),
  
  body("category")
    .optional()
    .isIn(CATEGORY_KEYS)
    .withMessage("Некорректная категория"),
  
  body("type")
    .optional()
    .isIn(["product", "service"])
    .withMessage("Некорректный тип публикации"),
  
  body("link")
    .optional()
    .trim()
    .isURL()
    .withMessage("Некорректный URL"),
  
  body("video_url")
    .optional()
    .trim()
    .isURL()
    .withMessage("Некорректный URL видео"),
  
  body("phone")
    .optional()
    .trim()
    .matches(/^[\d\s\+\-\(\)]*$/)
    .withMessage("Некорректный формат телефона"),
  
  body("email")
    .optional()
    .trim()
    .isEmail()
    .withMessage("Некорректный формат email")
    .normalizeEmail(),
  
  body("telegram")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Telegram не должен превышать 100 символов"),
  
  body("whatsapp")
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage("WhatsApp не должен превышать 50 символов"),
  
  body("contact_method")
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Способ связи не должен превышать 200 символов"),
  
  handleValidationErrors
];

// Валидация ID товара
const validateProductId = [
  param("id")
    .notEmpty()
    .withMessage("ID товара обязателен")
    .isMongoId()
    .withMessage("Некорректный ID товара"),
  
  handleValidationErrors
];

// Валидация ID услуги (использует ту же логику, что и товар)
const validateServiceId = validateProductId;

// Валидация ID баннера
const validateBannerId = [
  param("id")
    .notEmpty()
    .withMessage("ID баннера обязателен")
    .isMongoId()
    .withMessage("Некорректный ID баннера"),
  
  handleValidationErrors
];

// Валидация создания/редактирования услуги (аналогично товару)
const validateService = validateProduct;

// Валидация создания/редактирования баннера
const validateBanner = [
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Название баннера обязательно")
    .isLength({ min: 1, max: 200 })
    .withMessage("Название должно быть от 1 до 200 символов"),
  
  body("price")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Цена должна быть положительным числом"),
  
  body("description")
    .optional()
    .trim()
    .isLength({ max: 5000 })
    .withMessage("Описание не должно превышать 5000 символов"),
  
  body("category")
    .optional()
    .isIn(CATEGORY_KEYS)
    .withMessage("Некорректная категория"),
  
  body("link")
    .optional()
    .trim()
    .isURL()
    .withMessage("Некорректный URL"),
  
  body("video_url")
    .optional()
    .trim()
    .isURL()
    .withMessage("Некорректный URL видео"),
  
  body("status")
    .optional()
    .isIn(["published", "blocked", "draft", "pending", "approved", "rejected"])
    .withMessage("Некорректный статус"),
  
  handleValidationErrors
];

// Валидация логина
const validateLogin = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Логин обязателен")
    .isLength({ min: 3, max: 50 })
    .withMessage("Логин должен быть от 3 до 50 символов"),
  
  body("password")
    .notEmpty()
    .withMessage("Пароль обязателен")
    .isLength({ min: 6 })
    .withMessage("Пароль должен быть не менее 6 символов"),
  
  handleValidationErrors
];

// Валидация регистрации
const validateRegister = [
  body("username")
    .trim()
    .notEmpty()
    .withMessage("Логин обязателен")
    .isLength({ min: 3, max: 50 })
    .withMessage("Логин должен быть от 3 до 50 символов")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Логин может содержать только буквы, цифры и подчеркивание"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email обязателен")
    .isEmail()
    .withMessage("Некорректный формат email")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Пароль обязателен")
    .isLength({ min: 8 })
    .withMessage("Пароль должен быть не менее 8 символов")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage("Пароль должен содержать хотя бы одну заглавную букву, одну строчную букву и одну цифру"),

  handleValidationErrors
];

// Валидация рейтинга (поддерживает новый формат vote: "up"/"down" и старый value: "like"/"dislike")
const validateRating = [
  body("vote")
    .optional()
    .isIn(["up", "down"])
    .withMessage("Значение vote должно быть 'up' или 'down'"),
  
  body("value")
    .optional()
    .isIn(["like", "dislike"])
    .withMessage("Значение value должно быть 'like' или 'dislike'"),
  
  // Проверяем, что хотя бы одно из полей присутствует
  body().custom((value) => {
    if (!value.vote && !value.value) {
      throw new Error("Необходимо указать vote ('up'/'down') или value ('like'/'dislike')");
    }
    return true;
  }),
  
  handleValidationErrors
];

// Валидация модерации
const validateModeration = [
  body("reason")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Причина отклонения не должна превышать 1000 символов"),
  
  handleValidationErrors
];

// Валидация Instagram oEmbed
const validateInstagramUrl = [
  query("url")
    .notEmpty()
    .withMessage("URL обязателен")
    .isURL()
    .withMessage("Некорректный URL")
    .custom((value) => {
      if (!value.includes('instagram.com')) {
        throw new Error("URL должен быть ссылкой на Instagram");
      }
      return true;
    }),
  
  handleValidationErrors
];

module.exports = {
  validateProduct,
  validateProductId,
  validateService,
  validateServiceId,
  validateBanner,
  validateBannerId,
  validateLogin,
  validateRegister,
  validateRating,
  validateModeration,
  validateInstagramUrl,
  handleValidationErrors
};
