const ejs = require('ejs');
const path = require('path');
const { sendMail } = require('./emailService');

const DEFAULT_BASE_URL = 'http://localhost:3000';

function resolveBaseUrl() {
  const baseUrl = process.env.BASE_URL;
  if (baseUrl) {
    return baseUrl.replace(/\/$/, '');
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BASE_URL must be set in production for email links.');
  }
  return DEFAULT_BASE_URL;
}

function resolveSupportEmail() {
  return process.env.SUPPORT_EMAIL || process.env.EMAIL_FROM || 'support@albamount.xyz';
}

function resolveAdminEmail(fallback) {
  return process.env.ADMIN_EMAIL
    || fallback
    || process.env.SUPPORT_EMAIL
    || process.env.EMAIL_FROM
    || 'admin@albamount.xyz';
}

async function notifyAdmin(eventType, details, data = {}) {
  try {
    const baseUrl = resolveBaseUrl();
    const supportEmail = resolveSupportEmail();
    const adminEmail = resolveAdminEmail();
    const adminPanelLink = `${baseUrl}/admin`;
    const logoUrl = `${baseUrl}/albamount.png`;
    const subject = `Уведомление: ${eventType}`;
    const preheader = `Новое событие в ALBAMOUNT: ${eventType}`;

    const html = await ejs.renderFile(path.join(__dirname, '../views/emails/admin-notification.ejs'), {
      subject,
      preheader,
      logoUrl,
      baseUrl,
      supportEmail,
      eventType,
      details,
      data,
      adminPanelLink
    });

    await sendMail({
      to: adminEmail,
      subject,
      html
    });
    console.log(`✅ Уведомление администратору отправлено: ${subject}`);
  } catch (error) {
    console.error('❌ Ошибка при отправке уведомления администратору:', error);
  }
}

module.exports = { notifyAdmin, resolveAdminEmail };
