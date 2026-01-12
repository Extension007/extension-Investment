const crypto = require('crypto');
const ejs = require('ejs');
const path = require('path');
const User = require('../models/User');
const { transporter } = require('./emailService');
const emailConfig = require('../config/email');

async function sendVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString('hex');
 const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 часа

  user.verificationToken = token;
  user.verificationTokenExpires = expires;
  user.lastVerificationSent = new Date(); // Добавляем время последней отправки
 await user.save();

  const verificationLink = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/verify-email/${token}`;

  try {
    const html = await ejs.renderFile(path.join(__dirname, '../views/emails/verification-template.ejs'), {
      username: user.username,
      verificationLink,
      validityPeriod: '24 часов'
    });

    await transporter.sendMail({
      from: emailConfig.from,
      to: user.email,
      subject: 'Подтвердите ваш email',
      html
    });
  } catch (error) {
    // Если произошла ошибка при отправке письма, удаляем токен и время истечения
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    user.lastVerificationSent = undefined;
    await user.save().catch(saveError => {
      console.error('Ошибка при очистке данных верификации:', saveError);
    });
    
    throw error; // Пробрасываем ошибку дальше для обработки в контроллере
  }
}

async function resendVerificationEmail(email) {
  const user = await User.findOne({ email, emailVerified: false });
  if (!user) {
    throw new Error('User not found or already verified');
  }

 await sendVerificationEmail(user);
}

async function verifyEmail(token) {
  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    throw new Error('Invalid or expired verification token');
  }

 user.emailVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  // Отправить письмо об успешном подтверждении
  const loginLink = `${process.env.BASE_URL || 'http://localhost:3000'}/user/login`;

  const html = await ejs.renderFile(path.join(__dirname, '../views/emails/confirmation-success-template.ejs'), {
    username: user.username,
    loginLink
  });

  await transporter.sendMail({
    from: emailConfig.from,
    to: user.email,
    subject: 'Email подтвержден!',
    html
  }).catch(error => {
    console.error('Ошибка при отправке письма подтверждения:', error);
    // Не выбрасываем ошибку, так как пользователь уже подтвержден в системе
 });

  return user;
}

module.exports = {
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmail
};
