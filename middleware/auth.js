// Middleware для авторизации
const { verifyToken } = require("../config/jwt");

function requireAdmin(req, res, next) {
  // Сначала пробуем получить данные из JWT токена
  let user = null;
  const token = req.cookies.exto_token || req.headers.authorization?.split(' ')[1]; // Bearer token
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      user = decoded;
    }
  }
  
  // Если JWT токен не действителен, пробуем старую систему (cookie или сессия)
  if (!user) {
    const isVercel = Boolean(process.env.VERCEL);
    
    if (isVercel) {
      // В Vercel serverless получаем данные из cookie
      const userCookie = req.cookies.exto_user;
      if (userCookie) {
        try {
          user = JSON.parse(userCookie);
        } catch (err) {
          // Если cookie повреждена, удаляем её
          res.clearCookie('exto_user');
        }
      }
    } else {
      // В обычной среде используем сессии
      user = req.session?.user;
    }
  }

  if (!user) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(401).json({ success: false, error: "Unauthorized", message: "Требуется авторизация" });
    return res.redirect("/admin/login");
  }
  
  // Проверяем роль админа
  if (user.role !== "admin") {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(403).json({ success: false, error: "Forbidden", message: "Доступ запрещен: требуется роль администратора" });
    return res.status(403).send("Доступ запрещен: требуется роль администратора");
  }
  next();
}

function requireUser(req, res, next) {
  // Сначала пробуем получить данные из JWT токена
  let user = null;
  const token = req.cookies.exto_token || req.headers.authorization?.split(' ')[1]; // Bearer token
  
  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      user = decoded;
    }
  }
  
  // Если JWT токен не действителен, пробуем старую систему (cookie или сессия)
  if (!user) {
    const isVercel = Boolean(process.env.VERCEL);
    
    if (isVercel) {
      // В Vercel serverless получаем данные из cookie
      const userCookie = req.cookies.exto_user;
      if (userCookie) {
        try {
          user = JSON.parse(userCookie);
        } catch (err) {
          // Если cookie повреждена, удаляем её
          res.clearCookie('exto_user');
        }
      }
    } else {
      // В обычной среде используем сессии
      user = req.session?.user;
    }
  }

  if (!user) {
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) return res.status(401).json({ success: false, error: "Unauthorized", message: "Требуется авторизация" });
    return res.redirect("/user/login");
  }
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
        const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
        if (wantsJson) {
          return res.status(400).json({ success: false, error: "Bad Request", message: "Неверный формат ID" });
        }
        return res.status(400).send("Неверный формат ID");
      }

      const item = await Model.findById(itemId);
      if (!item) {
        const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
        if (wantsJson) {
          return res.status(404).json({ success: false, error: "Not Found", message: "Карточка не найдена" });
        }
        return res.status(404).send("Карточка не найдена");
      }

      // Сначала пробуем получить данные из JWT токена
      let user = null;
      const token = req.cookies.exto_token || req.headers.authorization?.split(' ')[1]; // Bearer token
      
      if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
          user = decoded;
        }
      }
      
      // Если JWT токен не действителен, пробуем старую систему (cookie или сессия)
      if (!user) {
        const isVercel = Boolean(process.env.VERCEL);
        
        if (isVercel) {
          // В Vercel serverless получаем данные из cookie
          const userCookie = req.cookies.exto_user;
          if (userCookie) {
            try {
              user = JSON.parse(userCookie);
            } catch (err) {
              // Если cookie повреждена, удаляем её
              res.clearCookie('exto_user');
            }
          }
        } else {
          // В обычной среде используем сессии
          user = req.session?.user;
        }
      }

      // Админ имеет полный доступ
      if (user && user.role === "admin") {
        return next();
      }

      // Проверяем владельца
      const userId = user?._id?.toString();
      const ownerId = item.owner?.toString();

      if (!userId || userId !== ownerId) {
        const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
        if (wantsJson) {
          return res.status(403).json({ success: false, error: "Forbidden", message: "Доступ запрещен: вы не являетесь владельцем этой карточки" });
        }
        return res.status(403).send("Доступ запрещен: вы не являетесь владельцем этой карточки");
      }

      // Сохраняем карточку в req для использования в роутах
      req.item = item;
      next();
    } catch (err) {
      console.error("❌ Ошибка проверки владельца:", err);
      const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
      if (wantsJson) {
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
  requireOwnerOrAdmin
};
