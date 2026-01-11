// Роуты для управления контактами в админ-панели
const express = require("express");
const router = express.Router();
const ContactInfo = require("../models/ContactInfo");
const { HAS_MONGO } = require("../config/database");
const { requireAdmin } = require("../middleware/auth");
const { csrfToken } = require("../middleware/csrf");
const { notifyAdmin } = require("../services/adminNotificationService");

// Условный CSRF middleware для Vercel
const isVercel = Boolean(process.env.VERCEL);
const conditionalCsrfToken = isVercel ? (req, res, next) => next() : csrfToken;

// Страница управления контактами (только для админов)
router.get("/", requireAdmin, conditionalCsrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).send("Админка недоступна: отсутствует подключение к БД");

    // Получаем все контакты
    const contacts = await ContactInfo.find().sort({ type: 1, updatedAt: -1 });

    // Получаем статистику для отображения в шапке
    const Statistics = require("../models/Statistics");
    const User = require("../models/User");
    const [visitors, users] = await Promise.all([
      Statistics.findOne({ key: "visitors" }),
      User.countDocuments()
    ]);

    const visitorCount = visitors ? visitors.value : 0;
    const userCount = users || 0;

    // Генерируем CSRF токен для формы и API запросов
    const csrfTokenValue = res.locals.csrfToken || null;

    res.render("admin-contacts", {
      contacts: contacts || [],
      visitorCount,
      userCount,
      csrfToken: csrfTokenValue
    });
  } catch (err) {
    console.error("❌ Ошибка получения контактов (админ):", err);
    res.status(500).send("Ошибка базы данных");
  }
});

// Добавление контакта (админом)
router.post("/create", requireAdmin, conditionalCsrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });

    const { type, email, phone, description } = req.body;

    // Валидация обязательных полей
    if (!type || !email) {
      return res.status(400).json({ 
        success: false, 
        message: "Тип и email обязательны для заполнения" 
      });
    }

    // Проверка на допустимый тип
    if (!["admin", "founder", "service"].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: "Недопустимый тип контакта" 
      });
    }

    // Создание нового контакта
    const contact = new ContactInfo({
      type,
      email,
      phone: phone || undefined,
      description: description || undefined
    });

    await contact.save();

    // Отправляем уведомление администратору о создании контакта
    try {
      await notifyAdmin(
        'Создание контактной информации',
        `Администратор создал новую контактную информацию.`,
        {
          'Тип': contact.type,
          'Email': contact.email,
          'Телефон': contact.phone || 'Не указан',
          'Описание': contact.description || 'Не указано',
          'Дата создания': new Date().toLocaleString('ru-RU'),
          'Создано администратором': req.user?.username || 'Неизвестно'
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    res.status(201).json({ 
      success: true, 
      message: "Контакт успешно создан", 
      contact 
    });
  } catch (err) {
    console.error("❌ Ошибка создания контакта:", err);
    res.status(500).json({ 
      success: false, 
      message: "Ошибка создания контакта: " + err.message 
    });
  }
});

// Обновление контакта (админом)
router.post("/:id/update", requireAdmin, conditionalCsrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });

    const { id } = req.params;
    const { type, email, phone, description } = req.body;

    // Валидация ID
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "ID контакта обязателен" 
      });
    }

    // Валидация типа, если он предоставлен
    if (type && !["admin", "founder", "service"].includes(type)) {
      return res.status(400).json({ 
        success: false, 
        message: "Недопустимый тип контакта" 
      });
    }

    // Обновление контакта
    const updateData = {};
    if (type) updateData.type = type;
    if (email) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (description !== undefined) updateData.description = description;
    
    updateData.updatedAt = Date.now(); // Обновляем время последнего изменения

    const contact = await ContactInfo.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true } // Возвращаем обновленный документ и запускаем валидацию
    );

    if (!contact) {
      return res.status(404).json({ 
        success: false, 
        message: "Контакт не найден" 
      });
    }

    // Отправляем уведомление администратору об обновлении контакта
    try {
      await notifyAdmin(
        'Обновление контактной информации',
        `Администратор обновил контактную информацию.`,
        {
          'ID контакта': contact._id.toString(),
          'Тип': contact.type,
          'Email': contact.email,
          'Телефон': contact.phone || 'Не указан',
          'Описание': contact.description || 'Не указано',
          'Дата обновления': new Date().toLocaleString('ru-RU'),
          'Обновлено администратором': req.user?.username || 'Неизвестно'
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    res.json({ 
      success: true, 
      message: "Контакт успешно обновлен", 
      contact 
    });
  } catch (err) {
    console.error("❌ Ошибка обновления контакта:", err);
    res.status(500).json({ 
      success: false, 
      message: "Ошибка обновления контакта: " + err.message 
    });
  }
});

// Удаление контакта (админом)
router.post("/:id/delete", requireAdmin, conditionalCsrfToken, async (req, res) => {
  try {
    if (!HAS_MONGO) return res.status(503).json({ success: false, message: "Недоступно: отсутствует подключение к БД" });

    const { id } = req.params;

    // Валидация ID
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        message: "ID контакта обязателен" 
      });
    }

    const contact = await ContactInfo.findById(id);

    if (!contact) {
      return res.status(404).json({ 
        success: false, 
        message: "Контакт не найден" 
      });
    }

    await ContactInfo.findByIdAndDelete(id);

    // Отправляем уведомление администратору об удалении контакта
    try {
      await notifyAdmin(
        'Удаление контактной информации',
        `Администратор удалил контактную информацию.`,
        {
          'ID контакта': id,
          'Тип': contact.type,
          'Email': contact.email,
          'Телефон': contact.phone || 'Не указан',
          'Описание': contact.description || 'Не указано',
          'Дата удаления': new Date().toLocaleString('ru-RU'),
          'Удалено администратором': req.user?.username || 'Неизвестно'
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.json({ 
        success: true, 
        message: "Контакт успешно удален" 
      });
    }
    res.redirect("/admin/contacts"); // Редирект после успешного удаления
  } catch (err) {
    console.error("❌ Ошибка удаления контакта:", err);
    const wantsJson = req.xhr || req.get("accept")?.includes("application/json");
    if (wantsJson) {
      return res.status(500).json({ 
        success: false, 
        message: "Ошибка удаления контакта: " + err.message 
      });
    }
    res.status(500).send("Ошибка базы данных");
 }
});

module.exports = router;