const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const { notifyAdmin } = require('../services/adminNotificationService');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { csrfProtection } = require('../middleware/csrf');
const { canReadComments, canWriteComments, canEditComments, canDeleteComments } = require('../middleware/comments');

// Получаем доступ к сокету для рассылки комментариев
let io = null;
const setSocketIO = (socketIo) => {
  io = socketIo;
};

// Rate limiter для комментариев (5 в минуту)
const commentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 5,
  message: { success: false, message: 'Слишком много комментариев. Попробуйте позже.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware для проверки аутентификации
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Требуется авторизация' });
  }
  next();
};

// GET /api/comments/:cardId - получить комментарии для карточки
router.get('/:cardId', [
  param('cardId').isMongoId().withMessage('Некорректный ID карточки'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { cardId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Максимум 50

    // Определяем тип карточки (проверяем в Product и Service)
    const Product = require('../models/Product');
    const Banner = require('../models/Banner');
    let cardType = null;
    let card = null;

    // Сначала проверяем, является ли карточка Product (обычный товар)
    card = await Product.findById(cardId).lean();
    if (card) {
      // Проверяем, является ли это сервисом полю type
      if (card.type === 'service') {
        cardType = 'Service';
      } else {
        cardType = 'Product';
      }
    } else {
      // Если не найден как обычный Product, проверим, может быть это Service
      card = await Product.findOne({ _id: cardId, type: 'service' }).lean();
      if (card) {
        cardType = 'Service';
      } else {
        return res.status(404).json({ success: false, message: 'Карточка не найдена' });
      }
    }

    const comments = await Comment.getCommentsByCard(cardId, cardType, page, limit);
    const total = await Comment.getCommentCount(cardId, cardType);

    res.json({
      success: true,
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('Ошибка получения комментариев:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});


// POST /api/comments/:cardId - создать комментарий
router.post('/:cardId', canWriteComments, commentLimiter, async (req, res) => {
  try {
    // Валидация параметров вручную
    const { cardId } = req.params;
    const { text } = req.body;

    // Проверяем cardId
    if (!cardId || !require('mongoose').Types.ObjectId.isValid(cardId)) {
      return res.status(400).json({ success: false, message: 'Некорректный ID карточки' });
    }

    // Проверяем text
    if (!text || typeof text !== 'string' || text.trim().length < 1 || text.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Текст комментария должен быть от 1 до 1000 символов' });
    }

    // Определяем тип карточки
    const Product = require('../models/Product');
    let cardType = null;
    let card = null;

    // Сначала проверяем, является ли карточка Product (обычный товар)
    card = await Product.findById(cardId).lean();
    if (card) {
      // Проверяем, является ли это сервисом по полю type
      if (card.type === 'service') {
        cardType = 'Service';
      } else {
        cardType = 'Product';
      }
    } else {
      // Если не найден как обычный Product, проверим, может быть это Service (хотя в текущей реализации сервисы - это тоже Product с type='service')
      card = await Product.findOne({ _id: cardId, type: 'service' }).lean();
      if (card) {
        cardType = 'Service';
      } else {
        return res.status(404).json({ success: false, message: 'Карточка не найдена' });
      }
    }

    // Проверяем статус карточки (только approved карточки могут иметь комментарии)
    if (card.status !== 'approved') {
      return res.status(403).json({ success: false, message: 'Комментарии доступны только для опубликованных карточек' });
    }

    const comment = await Comment.create({
      cardId,
      cardType,
      userId: req.user._id,
      text: text.trim()
    });

    // Populate для ответа
    await comment.populate('userId', 'username');

    // Отправляем комментарий через сокет остальным участникам чата
    if (io) {
      try {
        const roomName = `card_${cardId}`;
        io.to(roomName).emit('comment:new', {
          _id: comment._id,
          userId: comment.userId,
          username: comment.userId.username || 'Пользователь',
          text: comment.text,
          createdAt: comment.createdAt
        });
      } catch (socketErr) {
        console.error('Ошибка отправки комментария через сокет:', socketErr);
      }
    }

    res.status(201).json({
      success: true,
      comment,
      message: 'Комментарий добавлен'
    });
  } catch (err) {
    console.error('Ошибка создания комментария:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Middleware для проверки админа
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Доступ запрещен: требуется роль администратора' });
  }
  next();
};

// PUT /api/comments/:id - редактировать комментарий (только админ)
router.put('/:id', canEditComments, csrfProtection, [
  param('id').isMongoId().withMessage('Некорректный ID комментария'),
  body('text').isLength({ min: 1, max: 1000 }).withMessage('Текст комментария должен быть от 1 до 1000 символов')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { text } = req.body;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Комментарий не найден' });
    }

    comment.text = text.trim();
    await comment.save();

    // Отправляем обновленный комментарий через сокет остальным участникам чата
    if (io) {
      try {
        const roomName = `card_${comment.cardId}`;
        io.to(roomName).emit('comment:updated', {
          _id: comment._id,
          text: comment.text,
          updatedAt: comment.updatedAt
        });
      } catch (socketErr) {
        console.error('Ошибка отправки обновления комментария через сокет:', socketErr);
      }
    }

    res.json({ success: true, comment, message: 'Комментарий обновлен' });
  } catch (err) {
    console.error('Ошибка обновления комментария:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// DELETE /api/comments/:id - удалить комментарий (только админ)
router.delete('/:id', canDeleteComments, csrfProtection, [
  param('id').isMongoId().withMessage('Некорректный ID комментария')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { id } = req.params;

    const comment = await Comment.findById(id);
    if (!comment) {
      return res.status(404).json({ success: false, message: 'Комментарий не найден' });
    }

    // Мягкое удаление
    comment.deleted = true;
    await comment.save();

    // Отправляем уведомление об удалении комментария через сокет остальным участникам чата
    if (io) {
      try {
        const roomName = `card_${comment.cardId}`;
        io.to(roomName).emit('comment:deleted', {
          _id: comment._id
        });
      } catch (socketErr) {
        console.error('Ошибка отправки уведомления об удалении комментария через сокет:', socketErr);
      }
    }

    res.json({ success: true, message: 'Комментарий удален' });
  } catch (err) {
    console.error('Ошибка удаления комментария:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

module.exports = router;
module.exports.setSocketIO = setSocketIO;
