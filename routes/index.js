// Роуты для главной страницы (каталог)
const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const Banner = require("../models/Banner");
const User = require("../models/User");
const Statistics = require("../models/Statistics");
const { CATEGORY_LABELS, CATEGORY_KEYS } = require("../config/constants");
const { HAS_MONGO } = require("../config/database");

// Главная страница — каталог (только опубликованные карточки)
router.get("/", async (req, res) => {
  try {
    const isAuth = Boolean(req.session.user);
    const userRole = req.session.user?.role || null;
    const isAdmin = userRole === "admin";
    const isUser = userRole === "user";
    const selected = req.query.category;
    const page = parseInt(req.query.page) || 1;
    const limit = 20; // Пагинация: 20 товаров на страницу

    // Определяем категории
    const categories = typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {};
    const categoryKeys = typeof CATEGORY_KEYS !== 'undefined' ? CATEGORY_KEYS : [];

    if (!HAS_MONGO) {
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
    
    // Проверяем подключение к БД
    const dbState = mongoose.connection.readyState;
    if (dbState !== 1) {
      const stateNames = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
      console.warn(`⚠️ MongoDB не подключена (состояние: ${dbState} = ${stateNames[dbState] || 'unknown'}), показываем пустой каталог`);
      
      if (dbState === 2) {
        let waited = 0;
        while (mongoose.connection.readyState === 2 && waited < 2000) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waited += 100;
        }
        if (mongoose.connection.readyState === 1) {
          console.log("✅ MongoDB подключилась после ожидания");
        } else {
          console.warn("⚠️ MongoDB все еще не подключена после ожидания, показываем пустой каталог");
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
      } else {
        return res.render("index", { 
          products: [], 
          services: [], 
          banners: [], 
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
    }
    
    // Фильтр для товаров
    const productsFilter = { 
      $and: [
        {
          $or: [
            { status: "approved" },
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
        },
        { deleted: { $ne: true } }
      ]
    };
    
    // Фильтр для услуг
    const servicesFilter = { 
      $and: [
        {
          $or: [
            { status: "approved" },
            { status: { $exists: false } },
            { status: null }
          ]
        },
        { type: "service" },
        { deleted: { $ne: true } }
      ]
    };
    
    if (selected && categoryKeys.includes(selected)) {
      productsFilter.$and.push({ category: selected });
      servicesFilter.$and.push({ category: selected });
    }
    
    // Выполняем запросы с пагинацией и параллельно
    let products = [];
    let services = [];
    let productsTotal = 0;
    let servicesTotal = 0;
    
    try {
      const skip = (page - 1) * limit;
      
      [products, productsTotal, services, servicesTotal] = await Promise.all([
        Product.find(productsFilter).sort({ _id: -1 }).skip(skip).limit(limit).maxTimeMS(5000),
        Product.countDocuments(productsFilter).maxTimeMS(5000),
        Product.find(servicesFilter).sort({ _id: -1 }).skip(skip).limit(limit).maxTimeMS(5000),
        Product.countDocuments(servicesFilter).maxTimeMS(5000)
      ]);
    } catch (queryErr) {
      console.warn("⚠️ Ошибка запроса к БД:", queryErr.message);
      return res.render("index", { 
        products: [], 
        services: [], 
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
    
    // Помечаем где пользователь голосовал
    const userId = req.session.user?._id?.toString();
    const votedMap = {};
    [...products, ...services].forEach(p => {
      if (Array.isArray(p.voters) && p.voters.map(v => v.toString()).includes(userId)) {
        votedMap[p._id.toString()] = true;
      }
    });
    
    // Получаем одобренные баннеры
    let approvedBanners = [];
    try {
      approvedBanners = await Banner.find({ status: "approved" }).sort({ _id: -1 }).maxTimeMS(5000);
    } catch (bannerErr) {
      console.warn("⚠️ Ошибка получения баннеров:", bannerErr.message);
    }
    
    // Подсчет посетителей
    let visitorCount = 0;
    try {
      const visitorCookie = req.cookies.exto_visitor;
      
      if (!visitorCookie) {
        const stats = await Statistics.findOneAndUpdate(
          { key: "visitors" },
          { $inc: { value: 1 } },
          { upsert: true, new: true }
        );
        visitorCount = stats.value;
        
        res.cookie('exto_visitor', '1', {
          maxAge: 365 * 24 * 60 * 60 * 1000,
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax'
        });
      } else {
        const stats = await Statistics.findOne({ key: "visitors" });
        visitorCount = stats ? stats.value : 0;
      }
    } catch (visitorErr) {
      console.warn("⚠️ Ошибка подсчета посетителей:", visitorErr.message);
    }
    
    // Количество зарегистрированных пользователей
    let userCount = 0;
    try {
      userCount = await User.countDocuments({});
    } catch (userErr) {
      console.warn("⚠️ Ошибка подсчета пользователей:", userErr.message);
    }
    
    const totalPages = Math.max(
      Math.ceil(productsTotal / limit),
      Math.ceil(servicesTotal / limit)
    );
    
    res.render("index", { 
      products, 
      services, 
      banners: approvedBanners, 
      visitorCount, 
      userCount,
      page, 
      totalPages, 
      isAuth, 
      isAdmin, 
      isUser, 
      userRole, 
      votedMap, 
      categories, 
      selectedCategory: selected || "all" 
    });
  } catch (err) {
    console.error("❌ Ошибка получения товаров:", err);
    console.error("❌ Детали ошибки:", err.message);
    console.error("❌ Стек ошибки:", err.stack);
    
    try {
      const isAuth = Boolean(req.session.user);
      const userRole = req.session.user?.role || null;
      const isAdmin = userRole === "admin";
      const isUser = userRole === "user";
      const selected = req.query.category || "all";
      const categories = typeof CATEGORY_LABELS !== 'undefined' ? CATEGORY_LABELS : {};
      
      res.render("index", { 
        products: [], 
        services: [],
        banners: [],
        visitorCount: 0,
        userCount: 0,
        page: 1, 
        totalPages: 1, 
        isAuth: isAuth || false, 
        isAdmin: isAdmin || false, 
        isUser: isUser || false, 
        userRole: userRole || null, 
        votedMap: {}, 
        categories: categories || {}, 
        selectedCategory: selected 
      });
    } catch (renderErr) {
      console.error("❌ Критическая ошибка рендеринга:", renderErr);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Ошибка</title></head>
        <body>
          <h1>Временная ошибка сервера</h1>
          <p>Попробуйте обновить страницу через несколько секунд.</p>
        </body>
        </html>
      `);
    }
  }
});

module.exports = router;
