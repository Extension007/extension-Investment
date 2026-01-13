const { verifyEmail, resendVerificationEmail } = require('../services/emailVerificationService');
const User = require('../models/User');
const { notifyAdmin } = require('../services/adminNotificationService');
const { getUserFromRequest } = require('../middleware/auth');

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const user = await verifyEmail(token);

    // Отправляем уведомление администратору о подтверждении email
    try {
      await notifyAdmin(
        'Подтверждение email пользователя',
        `Пользователь подтвердил свой email.`,
        {
          'Имя пользователя': user.username,
          'Email': user.email,
          'ID пользователя': user._id.toString(),
          'Дата подтверждения': new Date().toLocaleString('ru-RU')
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    // Рендерить шаблон успеха
    res.render('verification-success', {
      message: 'Ваш email успешно подтвержден!',
      username: user.username,
      csrfToken: res.locals.csrfToken
    });
  } catch (error) {
    console.error('Email verification error:', error.message);

    // Рендерить шаблон ошибки
    res.status(400).render('email-verification-error', {
      error: error.message,
      csrfToken: res.locals.csrfToken
    });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email required' });
    }

    await resendVerificationEmail(email);
    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    console.error('Resend verification error:', error.message);
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.verificationStatus = async (req, res) => {
  try {
    const authUser = getUserFromRequest(req);
    if (!authUser) {
      return res.status(401).redirect('/auth/user/login');
    }

    const user = await User.findById(authUser._id);

    if (!user) {
      return res.status(404).redirect('/auth/user/login');
    }

    res.render('verification-status', {
      user: user,
      csrfToken: res.locals.csrfToken
    });
  } catch (error) {
    console.error('Verification status error:', error.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
