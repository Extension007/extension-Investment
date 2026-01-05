const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const Product = require("../models/Product");
const Banner = require("../models/Banner");
const User = require("../models/User");
const Statistics = require("../models/Statistics");
const { HAS_MONGO, hasMongo } = require("../config/database");
const { CATEGORY_LABELS, CATEGORY_KEYS } = require("../config/app");

// Страница "О нас"
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
        selectedCategory: selected || "all",
        csrfToken: req.csrfToken ? req.csrfToken() : '',
        activeTab: 'about' // Указываем активную вкладку
      });
    }

    // Запросы - минимальная загрузка для страницы "О нас"
    const [products, services, banners, visitors, users] = await Promise.all([
      Product.find({ status: "approved" }).sort({ _id: -1 }).limit(5).maxTimeMS(5000), // Минимум для фона
      Product.find({ type: "service", status: "approved" }).sort({ _id: -1 }).limit(5).maxTimeMS(5000), // Минимум для фона
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

    res.render("about", {
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
      selectedCategory: selected || "all",
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      activeTab: 'about' // Указываем активную вкладку
    });
  } catch (err) {
    console.error("❌ Ошибка:", err);
    res.status(500).send("Временная ошибка сервера");
  }
});

module.exports = router;
