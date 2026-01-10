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
  await user.save();

  const verificationLink = `${process.env.BASE_URL || 'http://localhost:3000'}/auth/verify-email/${token}`;

  const html = await ejs.renderFile(path.join(__dirname, '../views/emails/verification-template.ejs'), {
    username: user.username,
    verificationLink
  });

  await transporter.sendMail({
    from: emailConfig.from,
    to: user.email,
    subject: 'Подтвердите ваш email',
    html
  });
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
  });

  return user;
}

module.exports = {
  sendVerificationEmail,
  resendVerificationEmail,
  verifyEmail
};
