const express = require("express");
const router = express.Router();

const Product = require("../config/database").Product;
const Category = require("../config/database").Category;
const User = require("../config/database").User;
const Statistics = require("../config/database").Statistics;
const { USE_POSTGRES, sequelize } = require("../config/database");
const { CATEGORY_LABELS, CATEGORY_KEYS } = require("../config/app");
const { Op } = require("sequelize");
const { publicProductWhere, publicServiceWhere } = require("../utils/catalogFilters");
const { translateLabel, localizeHierarchicalCategories } = require("../utils/categoryI18n");

function resolveSelectedCategoryDisplay(selected, hasDbAccess, categoryFlat) {
  if (!selected || selected === "all") return "all";
    // Check if selected is numeric ID (new integer IDs)
    if (typeof selected !== 'string' || !/^\d+$/.test(selected)) return selected;
    if (!hasDbAccess) return "Категория";
    const match = Object.values(categoryFlat || {}).find(
      (item) => item && item.id && item.id.toString() === selected
    );
    return match && match.name ? match.name : "Неизвестная категория";
  }

function catalogBasePath(req) {
  return req.baseUrl === "/services" ? "/services" : "/";
}

function servicesPageLocals(req, extras = {}) {
  const isAuth = Boolean(req.user);
  const userRole = req.user?.role || null;
  const catalogPath = catalogBasePath(req);
  return {
    products: [],
    services: [],
    visitors: 0,
    totalUsers: 0,
    selectedCategory: "all",
    hierarchicalCategories: typeof req.t === "function"
      ? localizeHierarchicalCategories(req.t.bind(req))
      : undefined,
    csrfToken: req.csrfToken ? req.csrfToken() : "",
    CATEGORY_LABELS,
    activeTab: "services",
    isAuth,
    isAdmin: userRole === "admin",
    isUser: userRole === "user",
    userRole,
    user: req.user,
    selectedCategoryValue: req.query.category || "all",
    searchMeta: { q: "", country: "", city: "", tag: "", priceMin: "", priceMax: "" },
    catalogPath,
    ...extras
  };
}

async function renderServicesCatalog(req, res) {
  try {
    const catalogPath = catalogBasePath(req);

    if (!USE_POSTGRES) {
      return res.render("services", servicesPageLocals(req, { catalogPath }));
    }

    const selected = req.query.category;
    const extra =
      selected && selected !== "all"
        ? (/^\d+$/.test(selected) ? { categoryId: parseInt(selected, 10) } : { category: selected })
        : undefined;
    const finalServicesFilter = publicServiceWhere(extra);

    const { buildCatalogFilters, mergeWhere } = require("../utils/catalogSearch");
    const { extras, order, meta: searchMeta } = buildCatalogFilters(req.query);
    const servicesWhere = mergeWhere(finalServicesFilter, extras);
    const productsWhere = mergeWhere(publicProductWhere(), extras);

    const categoryFlat = await Category.getFlatList("service");
    let selectedCategoryDisplay = resolveSelectedCategoryDisplay(selected, true, categoryFlat);
    if (selectedCategoryDisplay !== "all" && typeof req.t === "function") {
      selectedCategoryDisplay = translateLabel(selectedCategoryDisplay, req.t.bind(req));
    }

    const [products, services, visitors, users] = await Promise.all([
      Product.findAll({
        where: productsWhere,
        order,
        limit: 5,
        raw: true,
        nest: true
      }),
      Product.findAll({
        where: servicesWhere,
        order,
        limit: 48,
        raw: true,
        nest: true
      }),
      Statistics.increment("value", { by: 1, where: { key: "visitors" } }).then(() => Statistics.findOne({ where: { key: "visitors" } })),
      User.count()
    ]);

    res.render("services", servicesPageLocals(req, {
      products,
      services,
      visitors: visitors ? visitors.value : 0,
      totalUsers: users,
      selectedCategory: selectedCategoryDisplay,
      selectedCategoryValue: selected || "all",
      searchMeta,
      catalogPath
    }));
  } catch (err) {
    console.error("❌ Ошибка на странице услуг:", err);
    res.status(500).send("Ошибка сервера");
  }
}

router.get("/", renderServicesCatalog);

module.exports = router;
module.exports.renderServicesCatalog = renderServicesCatalog;
