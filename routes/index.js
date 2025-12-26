const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Product = require("../models/Product");
const Banner = require("../models/Banner");
const User = require("../models/User");
const Statistics = require("../models/Statistics");
const cloudinary = require("cloudinary").v2;
const { HAS_MONGO, hasMongo } = require("../config/database");
const { CATEGORY_LABELS, CATEGORY_KEYS } = require("../config/app");

// Авторизация
router.use("/", require("./auth"));

// API
router.use("/api", require("./api"));

// Кабинет пользователя
router.use("/cabinet", require("./cabinet"));

// Админ-панель
router.use("/admin", require("./admin"));

// Главная страница — каталог
router.get("/", async (req, res) => {
  try {
    const isAuth = Boolean(req.session?.user);
    const userRole = req.session?.user?.role || null;
    const isAdmin = userRole === "admin";
    const isUser = userRole === "user";
    const selected = req.query.category;

    const categories = CATEGORY_LABELS || {};
    const categoryKeys = CATEGORY_KEYS || [];

    const isVercel = Boolean(process.env.VERCEL);
    const hasDbAccess = isVercel ? req.dbConnected : HAS_MONGO;

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
        votedMap: {},
        categories,
        selectedCategory: selected || "all"
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

    if (selected && categoryKeys.includes(selected)) {
      productsFilter.$and.push({ category: selected });
      servicesFilter.$and.push({ category: selected });
    }

    // Запросы
    const [products, services, banners, visitors, users] = await Promise.all([
      Product.find(productsFilter).sort({ _id: -1 }).maxTimeMS(5000),
      Product.find(servicesFilter).sort({ _id: -1 }).maxTimeMS(5000),
      Banner.find({ status: "approved" }).sort({ _id: -1 }).maxTimeMS(5000),
      Statistics.findOne({ key: "visitors" }),
      User.countDocuments()
    ]);

    const visitorCount = visitors ? visitors.value : 0;
    const userCount = users || 0;

    const userId = req.session?.user?._id?.toString();
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
      votedMap,
      categories,
      selectedCategory: selected || "all"
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

module.exports = router;
