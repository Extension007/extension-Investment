// FIX: Маршруты для работы с товарами
const express = require("express");
const router = express.Router();
const productsController = require("../controllers/productsController");
const { uploadImages } = require("../config/upload");

// FIX: Middleware для проверки авторизации
const requireUser = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "Необходима авторизация" });
  }
  next();
};

// FIX: GET /products - список товаров
router.get("/", productsController.getAllProducts);

// FIX: GET /products/add - форма добавления товара
router.get("/add", requireUser, productsController.getAddForm);

// FIX: POST /products - создание товара с загрузкой до 5 изображений
router.post("/", requireUser, uploadImages, productsController.createProduct);

// FIX: GET /products/:id/edit - форма редактирования товара
router.get("/:id/edit", requireUser, productsController.getEditForm);

// FIX: POST /products/:id - обновление товара с загрузкой изображений
router.post("/:id", requireUser, uploadImages, productsController.updateProduct);

module.exports = router;

