const ContactInfo = require("../models/ContactInfo");
const { notifyAdmin } = require("../services/adminNotificationService");

/**
 * Получить список контактов и отрендерить страницу контактов
 */
exports.getContacts = async (req, res) => {
  try {
    const contacts = await ContactInfo.find().sort({ type: 1 }); // Сортировка по типу
    
    res.render("contacts", {
      // Передаем все необходимые переменные, которые использовались в оригинальном шаблоне
      products: [],
      services: [],
      banners: [],
      visitorCount: 0,
      userCount: 0,
      page: 1,
      totalPages: 1,
      isAuth: Boolean(req.user),
      isAdmin: req.user?.role === "admin",
      isUser: req.user?.role === "user",
      userRole: req.user?.role || null,
      user: req.user,
      votedMap: {},
      categories: {},
      selectedCategory: "all",
      csrfToken: req.csrfToken ? req.csrfToken() : '',
      activeTab: 'contacts',
      contacts: contacts // Добавляем контакты в рендер
    });
  } catch (err) {
    console.error("❌ Ошибка получения контактов:", err);
    res.status(500).send("Временная ошибка сервера");
  }
};

/**
 * Добавить новый контакт (доступно только админу)
 */
exports.createContact = async (req, res) => {
  try {
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
};

/**
 * Обновить существующий контакт (доступно только админу)
 */
exports.updateContact = async (req, res) => {
  try {
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
};

/**
 * Удалить контакт (доступно только админу)
 */
exports.deleteContact = async (req, res) => {
  try {
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

    res.json({ 
      success: true, 
      message: "Контакт успешно удален" 
    });
  } catch (err) {
    console.error("❌ Ошибка удаления контакта:", err);
    res.status(500).json({ 
      success: false, 
      message: "Ошибка удаления контакта: " + err.message 
    });
  }
};