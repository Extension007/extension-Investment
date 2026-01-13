const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Product = require("../models/Product");
const Banner = require("../models/Banner");
const User = require("../models/User");
const Statistics = require("../models/Statistics");
const Category = require("../models/Category");
const cloudinary = require("cloudinary").v2;
const { HAS_MONGO, hasMongo } = require("../config/database");
const { CATEGORY_LABELS, CATEGORY_KEYS, HIERARCHICAL_CATEGORIES } = require("../config/app");

// Авторизация
router.use("/auth", require("./auth"));

// API
router.use("/api", require("./api"));

// Кабинет пользователя
router.use("/cabinet", require("./cabinet"));

// Админ-панель
router.use("/admin", require("./admin"));

// API для категорий
router.use("/api/categories", require("./categories"));

// Страницы с вкладками
router.use("/products", require("./products"));
router.use("/services", require("./services"));
router.use("/ad", require("./ad"));
router.use("/about", require("./about"));
router.use("/contacts", require("./contacts"));

// Главная страница — каталог
router.get("/", async (req, res) => {
  try {
    const isAuth = Boolean(req.user);
    const userRole = req.user?.role || null;
    const isAdmin = userRole === "admin";
    const isUser = userRole === "user";
    const selected = req.query.category;

    const categories = CATEGORY_LABELS || {};
    const categoryKeys = CATEGORY_KEYS || [];

    const isVercel = Boolean(process.env.VERCEL);
    const hasDbAccess = isVercel ? req.dbConnected : HAS_MONGO;

    console.log('🔧 Отладка категории:', {
      selected,
      isVercel,
      hasDbAccess,
      isValidObjectId: selected ? mongoose.Types.ObjectId.isValid(selected) : false
    });

    // Определяем отображаемое название выбранной категории
    let selectedCategoryDisplay = selected || "all";
    if (selected && selected !== 'all') {
      // Проверяем, является ли selected названием категории (не ID)
      // Если да, то используем его напрямую
      if (!mongoose.Types.ObjectId.isValid(selected)) {
        console.log('📝 Selected является названием категории:', selected);
        selectedCategoryDisplay = selected;
      } else if (hasDbAccess) {
        try {
          console.log('🔍 Ищем категорию по ID:', selected);
          // Ищем категорию по ID и получаем ее название
          const category = await Category.findById(selected).select('name').lean();
          console.log('📋 Найденная категория:', category);
          if (category && category.name) {
            selectedCategoryDisplay = category.name;
            console.log('✅ Используем название категории:', selectedCategoryDisplay);
          } else {
            console.warn('⚠️ Категория не найдена или без названия');
            selectedCategoryDisplay = "Неизвестная категория";
          }
        } catch (err) {
          console.warn('❌ Ошибка поиска категории:', selected, err.message);
          selectedCategoryDisplay = "Ошибка загрузки категории";
        }
      } else {
        console.log('⏭️ Нет доступа к БД, оставляем ID');
        selectedCategoryDisplay = "Категория"; // Fallback когда нет доступа к БД
      }
    }
    console.log('📝 Финальное selectedCategoryDisplay:', selectedCategoryDisplay);

    if (!hasDbAccess) {
      return res.render("index", {
        products: [],
        services: [],
        banners: [],
        visitorCount: 0,
        userCount: 0,
        page: 1,
        totalPages: 1,
        isAuth,
        isAdmin,
        isUser,
        userRole,
        user: req.user,
        votedMap: {},
        categories,
        hierarchicalCategories: HIERARCHICAL_CATEGORIES,
        selectedCategory: selectedCategoryDisplay,
        csrfToken: req.csrfToken ? req.csrfToken() : ''
      });
    }

    // Фильтры
    const productsFilter = {
      $and: [
        { $or: [{ status: "approved" }, { status: { $exists: false } }, { status: null }] },
        { $or: [{ type: "product" }, { type: { $exists: false } }, { type: null }] }
      ]
    };
    const servicesFilter = {
      $and: [
        { $or: [{ status: "approved" }, { status: { $exists: false } }, { status: null }] },
        { type: "service" }
      ]
    };

    if (selected && selected !== 'all') {
      // Если выбранная категория - это ObjectId, используем categoryId напрямую
      if (mongoose.Types.ObjectId.isValid(selected)) {
        productsFilter.$and.push({ categoryId: selected });
        servicesFilter.$and.push({ categoryId: selected });
      } else {
        // Если это название категории, найдем ее ID
        try {
          console.log('🔍 Ищем ID категории по названию:', selected);
          const category = await Category.findOne({ name: selected }).select('_id').lean();
          if (category) {
            console.log('✅ Найден ID категории:', category._id);
            productsFilter.$and.push({ categoryId: category._id });
            servicesFilter.$and.push({ categoryId: category._id });
          } else {
            console.warn('⚠️ Категория с названием не найдена:', selected);
            // Не применяем фильтр, показываем все товары
          }
        } catch (err) {
          console.warn('❌ Ошибка поиска категории по названию:', selected, err.message);
          // Не применяем фильтр, показываем все товары
        }
      }
    }

    // Запросы
    const [products, services, banners, visitors, users] = await Promise.all([
      Product.find(productsFilter).sort({ _id: -1 }).maxTimeMS(5000),
      Product.find(servicesFilter).sort({ _id: -1 }).maxTimeMS(5000),
      Banner.find({ status: "approved" }).sort({ _id: -1 }).maxTimeMS(5000),
      Statistics.findOneAndUpdate(
        { key: "visitors" },
        { $inc: { value: 1 } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ),
      User.countDocuments()
    ]);

    const visitorCount = visitors ? visitors.value : 0;
    const userCount = users || 0;

    const userId = req.user?._id?.toString();
    const votedMap = {};
    [...products, ...services].forEach(p => {
      if (Array.isArray(p.voters) && p.voters.map(v => v.toString()).includes(userId)) {
        votedMap[p._id.toString()] = true;
      }
    });

    res.render("index", {
      products,
      services,
      banners,
      visitorCount,
      userCount,
      page: 1,
      totalPages: 1,
      isAuth,
      isAdmin,
      isUser,
      userRole,
      user: req.user,
      votedMap,
      categories,
      selectedCategory: selectedCategoryDisplay,
      csrfToken: req.csrfToken ? req.csrfToken() : ''
    });
  } catch (err) {
    console.error("❌ Ошибка:", err);
    res.status(500).send("Временная ошибка сервера");
  }
});

// Health-check Cloudinary
router.get("/__health/cloudinary", async (req, res) => {
  try {
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAukB9yx7CmoAAAAASUVORK5CYII=";
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "health-check",
      transformation: [{ width: 10, height: 10, crop: "limit" }]
    });
    res.json({ ok: true, public_id: result.public_id, secure_url: result.secure_url });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

// Health-check MongoDB
router.get("/health", (req, res) => {
  res.json({ mongo: hasMongo() ? "connected" : "disconnected" });
});

// Обработчик для Chrome DevTools и других .well-known запросов
router.get("/.well-known/*", (req, res) => {
  res.status(404).send("Not Found");
});

module.exports = router;
