// Middleware для проверки прав доступа к комментариям

const Comment = require('../models/Comment');
const Product = require('../models/Product');

/**
 * Проверяет, может ли пользователь читать комментарии карточки
 * Гости и авторизованные пользователи могут читать комментарии одобренных карточек
 */
function canReadComments(req, res, next) {
  // Все могут читать комментарии одобренных карточек
  // Проверка происходит в роуте GET /api/comments/:cardId
  next();
}

/**
 * Проверяет, может ли пользователь писать комментарии
 * Только авторизованные пользователи могут писать комментарии
 */
function canWriteComments(req, res, next) {
  console.log('🔍 Проверка авторизации для комментариев:');
  console.log('  - req.user:', req.user ? `${req.user._id} (${req.user.role || 'no-role'})` : 'null');
  console.log('  - req.session:', req.session ? 'exists' : 'null');
  console.log('  - cookies:', req.cookies ? Object.keys(req.cookies) : 'none');
  console.log('  - authorization header:', req.headers.authorization ? 'exists' : 'none');
  console.log('  - xhr:', req.xhr);
  console.log('  - accept header:', req.get('accept'));

  if (!req.user) {
    console.log('❌ Пользователь не авторизован, возвращаем 401');
    const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(401).json({ success: false, message: 'Требуется авторизация для добавления комментариев' });
    }
    return res.redirect('/user/login');
  }
  
  console.log('✅ Пользователь авторизован, разрешаем создание комментария');
  next();
}

/**
 * Проверяет, может ли пользователь редактировать комментарий
 * Только администраторы могут редактировать комментарии
 */
function canEditComments(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(403).json({ success: false, message: 'Только администраторы могут редактировать комментарии' });
    }
    return res.status(403).send('Только администраторы могут редактировать комментарии');
  }
  next();
}

/**
 * Проверяет, может ли пользователь удалять комментарий
 * Только администраторы могут удалять комментарии
 */
function canDeleteComments(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    const wantsJson = req.xhr || req.get('accept')?.includes('application/json');
    if (wantsJson) {
      return res.status(403).json({ success: false, message: 'Только администраторы могут удалять комментарии' });
    }
    return res.status(403).send('Только администраторы могут удалять комментарии');
  }
  next();
}

/**
 * Проверяет доступ к чату карточки для WebSocket
 * @param {string} cardId - ID карточки
 * @param {object} user - пользователь (может быть null для гостей)
 * @returns {object} - { allowed: boolean, canWrite: boolean, canModerate: boolean }
 */
async function checkChatAccess(cardId, user) {
  try {
    // Проверяем существование карточки
    const card = await Product.findById(cardId);
    if (!card) {
      return { allowed: false, canWrite: false, canModerate: false, reason: 'Карточка не найдена' };
    }

    // Только одобренные карточки имеют чат
    if (card.status !== 'approved') {
      return { allowed: false, canWrite: false, canModerate: false, reason: 'Чат доступен только для опубликованных карточек' };
    }

    // Гости могут только читать
    if (!user) {
      return { allowed: true, canWrite: false, canModerate: false, reason: 'Гость - только чтение' };
    }

    // Авторизованные пользователи могут читать и писать
    const isAdmin = user.role === 'admin';
    const isOwner = card.owner && card.owner.toString() === user._id.toString();

    return {
      allowed: true,
      canWrite: true,
      canModerate: isAdmin,
      isOwner,
      cardType: card.type === 'service' ? 'Service' : 'Product'
    };
  } catch (error) {
    console.error('❌ Ошибка проверки доступа к чату:', error);
    return { allowed: false, canWrite: false, canModerate: false, reason: 'Ошибка проверки доступа' };
  }
}

module.exports = {
  canReadComments,
  canWriteComments,
  canEditComments,
  canDeleteComments,
  checkChatAccess
};
