// API для управления категориями
const express = require("express");
const router = express.Router();
const Category = require("../models/Category");
const { requireAdmin } = require("../middleware/auth");
const { HAS_MONGO } = require("../config/database");

// Получение дерева категорий по типу
router.get("/tree/:type?", async (req, res) => {
  try {
    if (!HAS_MONGO) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const type = req.params.type || 'all';
    const includeInactive = req.query.includeInactive === 'true';

    const tree = await Category.getTree(type, includeInactive);

    res.json({
      success: true,
      categories: tree
    });
  } catch (err) {
    console.error("Ошибка получения дерева категорий:", err);
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: err.message
    });
  }
});

// Получение плоского списка категорий
router.get("/flat/:type?", async (req, res) => {
  try {
    if (!HAS_MONGO) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const type = req.params.type || 'all';
    const includeInactive = req.query.includeInactive === 'true';

    const flatList = await Category.getFlatList(type, includeInactive);

    res.json({
      success: true,
      categories: flatList
    });
  } catch (err) {
    console.error("Ошибка получения плоского списка категорий:", err);
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: err.message
    });
  }
});

// Получение подкатегорий по parentId
router.get("/children/:parentId", async (req, res) => {
  try {
    if (!HAS_MONGO) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const { parentId } = req.params;
    const type = req.query.type || 'all';

    const filter = {
      parentId: parentId,
      isActive: true
    };

    if (type !== 'all') {
      filter.$or = [
        { type: type },
        { type: 'all' }
      ];
    }

    const children = await Category.find(filter)
      .sort({ order: 1, name: 1 })
      .lean();

    res.json({
      success: true,
      categories: children
    });
  } catch (err) {
    console.error("Ошибка получения подкатегорий:", err);
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: err.message
    });
  }
});

// Создание новой категории (только админ)
router.post("/", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const { name, parentId, type, icon, description, order, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Название категории обязательно"
      });
    }

    // Проверяем, что родительская категория существует
    if (parentId) {
      const parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Родительская категория не найдена"
        });
      }
    }

    const category = new Category({
      name: name.trim(),
      parentId: parentId || null,
      type: type || 'all',
      icon: icon || '',
      description: description || '',
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: req.user._id
    });

    await category.save();

    res.json({
      success: true,
      message: "Категория создана",
      category
    });
  } catch (err) {
    console.error("Ошибка создания категории:", err);
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: err.message
    });
  }
});

// Обновление категории (только админ)
router.put("/:id", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const { id } = req.params;
    const { name, parentId, type, icon, description, order, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Категория не найдена"
      });
    }

    // Проверяем, что родительская категория существует и не является потомком самой себя
    if (parentId) {
      if (parentId === id) {
        return res.status(400).json({
          success: false,
          message: "Категория не может быть родителем самой себя"
        });
      }

      const parent = await Category.findById(parentId);
      if (!parent) {
        return res.status(400).json({
          success: false,
          message: "Родительская категория не найдена"
        });
      }
    }

    category.name = name ? name.trim() : category.name;
    category.parentId = parentId !== undefined ? parentId : category.parentId;
    category.type = type || category.type;
    category.icon = icon !== undefined ? icon : category.icon;
    category.description = description !== undefined ? description : category.description;
    category.order = order !== undefined ? order : category.order;
    category.isActive = isActive !== undefined ? isActive : category.isActive;

    await category.save();

    res.json({
      success: true,
      message: "Категория обновлена",
      category
    });
  } catch (err) {
    console.error("Ошибка обновления категории:", err);
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: err.message
    });
  }
});

// Удаление категории (только админ)
router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    if (!HAS_MONGO) {
      return res.status(503).json({ success: false, message: "База данных недоступна" });
    }

    const { id } = req.params;

    // Проверяем, есть ли подкатегории
    const children = await Category.find({ parentId: id });
    if (children.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Нельзя удалить категорию, у которой есть подкатегории"
      });
    }

    // Проверяем, используется ли категория в товарах/услугах/баннерах
    const Product = require("../models/Product");
    const Banner = require("../models/Banner");

    const productsCount = await Product.countDocuments({ categoryId: id });
    const bannersCount = await Banner.countDocuments({ categoryId: id });

    if (productsCount > 0 || bannersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Категория используется в ${productsCount + bannersCount} записях`
      });
    }

    const category = await Category.findByIdAndDelete(id);
    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Категория не найдена"
      });
    }

    res.json({
      success: true,
      message: "Категория удалена"
    });
  } catch (err) {
    console.error("Ошибка удаления категории:", err);
    res.status(500).json({
      success: false,
      message: "Ошибка сервера",
      error: err.message
    });
  }
});

module.exports = router;
