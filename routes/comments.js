const express = require('express');
const router = express.Router();
const logger = require('../utils/logger');
const Comment = require('../models/Comment');
const Product = require('../models/Product');
const { notifyAdmin } = require('../services/adminNotificationService');
const { body, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { csrfProtection } = require('../middleware/csrf');
const { canReadComments, canWriteComments, canEditComments, canDeleteComments } = require('../middleware/comments');
const { Op } = require('sequelize');
const { getAuthUserId } = require('../middleware/auth');
const { getUnreadSummary, markCardRead } = require('../services/chatUnreadService');

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

router.get('/unread', requireAuth, async (req, res) => {
  try {
    const summary = await getUnreadSummary(getAuthUserId(req.user));
    res.json({ success: true, ...summary });
  } catch (err) {
    logger.error({ msg: 'comments_unread_error', error: err.message, stack: err.stack, path: req.path });
    res.status(500).json({ success: false, message: 'Ошибка сервера', cards: {}, total: 0 });
  }
});

router.post('/:cardId/read', requireAuth, csrfProtection, async (req, res) => {
  try {
    const { isValidEntityId } = require('../utils/idValidation');
    if (!isValidEntityId(req.params.cardId)) {
      return res.status(400).json({ success: false, message: 'Некорректный ID карточки' });
    }
    await markCardRead(getAuthUserId(req.user), req.params.cardId);
    res.json({ success: true });
  } catch (err) {
    logger.error({ msg: 'comments_read_error', error: err.message, stack: err.stack, path: req.path });
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// GET /api/comments/:cardId - получить комментарии для карточки
router.get('/:cardId', [
  param('cardId').isString().isLength({ min: 1 }).withMessage('Некорректный ID карточки'),
], canReadComments, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { cardId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const cardType = req.discussionCardType;

    const comments = await Comment.getCommentsByCard(cardId, cardType, page, limit);
    const total = await Comment.getCommentCount(cardId);

    if (req.user) {
      try {
        await markCardRead(getAuthUserId(req.user), cardId);
      } catch (readErr) {
        logger.warn({ msg: 'comments_mark_read_failed', error: readErr.message, cardId });
      }
    }

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
    logger.error({ msg: 'comments_error', error: err.message, stack: err.stack, path: req.path });
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// POST /api/comments/:cardId - создать комментарий
router.post('/:cardId', canWriteComments, commentLimiter, csrfProtection, async (req, res) => {
  try {
    const { cardId } = req.params;
    const { text } = req.body;

    const { isValidEntityId } = require('../utils/idValidation');
    if (!cardId || !isValidEntityId(cardId)) {
      return res.status(400).json({ success: false, message: 'Некорректный ID карточки' });
    }

    // Проверяем text
    if (!text || typeof text !== 'string' || text.trim().length < 1 || text.trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Текст комментария должен быть от 1 до 1000 символов' });
    }

    // Определяем тип карточки
    let cardType = null;
    let card = await Product.findByPk(cardId);
    if (card) {
      cardType = card.type === 'service' ? 'Service' : 'Product';
    } else {
        return res.status(404).json({ success: false, message: 'Карточка не найдена' });
    }

    const { isLive } = require('../utils/cardPublication');
    if (!isLive(card)) {
      return res.status(403).json({ success: false, message: 'Комментарии доступны только для опубликованных карточек' });
    }

    const comment = await Comment.create({
      cardId,
      cardType,
      userId: req.user._id || req.user.id,
      text: text.trim()
    });

    const User = require('../models/User');
    const { serializeComment } = require('../utils/commentSerialize');
    const user = await User.findByPk(req.user.id, { attributes: ['id', 'username'] });
    const payload = serializeComment(comment, {
      user,
      username: user && user.username,
      cardId
    });

    if (io && payload) {
      try {
        io.to(`card_${cardId}`).emit('comment:new', payload);
      } catch (socketErr) {
        logger.error({ msg: 'comments_socket_error', error: socketErr.message, stack: socketErr.stack, path: req.path });
      }
    }

    res.status(201).json({
      success: true,
      comment: payload,
      message: 'Комментарий добавлен'
    });
  } catch (err) {
    console.error('Ошибка создания комментария:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// PUT /api/comments/:id - редактировать комментарий (только админ)
router.put('/:id', canEditComments, csrfProtection, [
  param('id').isString().withMessage('Некорректный ID комментария'),
  body('text').isLength({ min: 1, max: 1000 }).withMessage('Текст комментария должен быть от 1 до 1000 символов')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const { id } = req.params;
    const { text } = req.body;

    const comment = await Comment.findByPk(id);
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
          id: comment.id,
          _id: comment.id,
          cardId: String(comment.cardId),
          text: comment.text,
          updatedAt: comment.updatedAt
        });
      } catch (socketErr) {
        console.error('Ошибка отправки обновления комментария:', socketErr);
      }
    }

    res.json({
      success: true,
      comment: comment.get({ plain: true }),
      message: 'Комментарий обновлен'
    });
  } catch (err) {
    console.error('Ошибка редактирования комментария:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// DELETE /api/comments/:id - удалить своё сообщение или любое (админ)
router.delete('/:id', canDeleteComments, csrfProtection, async (req, res) => {
  try {
    const { id } = req.params;
    const { isValidEntityId } = require('../utils/idValidation');
    if (!isValidEntityId(id)) {
      return res.status(400).json({ success: false, message: 'Некорректный ID комментария' });
    }

    const comment = await Comment.findByPk(id);
    if (!comment || comment.deleted) {
      return res.status(404).json({ success: false, message: 'Комментарий не найден' });
    }

    const { canDeleteComment } = require('../utils/commentAccess');
    if (!canDeleteComment(req.user, comment)) {
      return res.status(403).json({ success: false, message: 'Можно удалить только своё сообщение' });
    }

    comment.deleted = true;
    await comment.save();

    // Отправляем уведомление об удалении всем участникам комнаты
    if (io) {
      try {
        const roomName = `card_${comment.cardId}`;
        io.to(roomName).emit('comment:deleted', {
          id: comment.id,
          _id: comment.id,
          cardId: String(comment.cardId)
        });
      } catch (socketErr) {
        console.error('Ошибка отправки удаления комментария:', socketErr);
      }
    }

    res.json({
      success: true,
      message: 'Комментарий удален'
    });
  } catch (err) {
    console.error('Ошибка удаления комментария:', err);
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

// Экспортируем оба объекта: роутер и функцию установки сокета
module.exports = {
  router: router,
  setSocketIO: setSocketIO
};