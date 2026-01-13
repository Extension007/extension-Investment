// Middleware для авторизации
const { verifyToken } = require("../config/jwt");

// Функция для получения пользователя из различных источников
function getUserFromRequest(req) {
  let user = null;
  const token = req.cookies.exto_token || req.headers.authorization?.split(' ')[1]; // Bearer token

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      user = decoded;
    }
  }

  if (!user) {
    user = req.session?.user;
  }

  return user;
}


// Функция для определения типа ответа (JSON или HTML)
function wantsJsonResponse(req) {
  return req.xhr || req.get("accept")?.includes("application/json");
}

function requireAdmin(req, res, next) {
  const user = getUserFromRequest(req);

  if (!user) {
    if (wantsJsonResponse(req)) {
      return res.status(401).json({ success: false, error: "Unauthorized", message: "Требуется авторизация" });
    }
    return res.redirect("/admin/login");
  }
  
  // Проверяем роль админа
  if (user.role !== "admin") {
    if (wantsJsonResponse(req)) {
      return res.status(403).json({ success: false, error: "Forbidden", message: "Доступ запрещен: требуется роль администратора" });
    }
    return res.status(403).send("Доступ запрещен: требуется роль администратора");
  }
  req.currentUser = user; // Сохраняем пользователя в запросе для дальнейшего использования
  next();
}

function requireUser(req, res, next) {
  const user = getUserFromRequest(req);

  if (!user) {
    if (wantsJsonResponse(req)) {
      return res.status(401).json({ success: false, error: "Unauthorized", message: "Требуется авторизация" });
    }
    return res.redirect("/user/login");
  }
  req.currentUser = user; // Сохраняем пользователя в запросе для дальнейшего использования
  next();
}

/**
 * Middleware для проверки владельца карточки
 * Админ имеет полный доступ, пользователь - только к своим карточкам
 * @param {string} modelName - имя модели ('Product' или 'Banner')
 * @param {string} paramName - имя параметра с ID (по умолчанию 'id')
 */
function requireOwnerOrAdmin(modelName = 'Product', paramName = 'id') {
  return async (req, res, next) => {
    try {
      const mongoose = require('mongoose');
      const Product = require('../models/Product');
      const Banner = require('../models/Banner');
      
      const Model = modelName === 'Banner' ? Banner : Product;
      const itemId = req.params[paramName];
      
      if (!mongoose.Types.ObjectId.isValid(itemId)) {
        if (wantsJsonResponse(req)) {
          return res.status(400).json({ success: false, error: "Bad Request", message: "Неверный формат ID" });
        }
        return res.status(400).send("Неверный формат ID");
      }

      const item = await Model.findById(itemId);
      if (!item) {
        if (wantsJsonResponse(req)) {
          return res.status(404).json({ success: false, error: "Not Found", message: "Карточка не найдена" });
        }
        return res.status(404).send("Карточка не найдена");
      }

      const user = getUserFromRequest(req);

      // Админ имеет полный доступ
      if (user && user.role === "admin") {
        req.currentUser = user; // Сохраняем пользователя в запросе
        return next();
      }

      // Проверяем владельца
      const userId = user?._id?.toString();
      const ownerId = item.owner?.toString();

      if (!userId || userId !== ownerId) {
        if (wantsJsonResponse(req)) {
          return res.status(403).json({ success: false, error: "Forbidden", message: "Доступ запрещен: вы не являетесь владельцем этой карточки" });
        }
        return res.status(403).send("Доступ запрещен: вы не являетесь владельцем этой карточки");
      }

      // Сохраняем карточку в req для использования в роутах
      req.item = item;
      req.currentUser = user; // Сохраняем пользователя в запросе
      next();
    } catch (err) {
      console.error("❌ Ошибка проверки владельца:", err);
      if (wantsJsonResponse(req)) {
        return res.status(500).json({ success: false, error: "Server Error", message: "Ошибка проверки прав доступа" });
      }
      return res.status(500).send("Ошибка проверки прав доступа");
    }
  };
}

// Для обратной совместимости
const requireAuth = requireAdmin;

module.exports = {
  requireAdmin,
  requireUser,
  requireAuth,
  requireOwnerOrAdmin,
  getUserFromRequest, // Экспортируем вспомогательную функцию для использования в других местах
  wantsJsonResponse
};
