const ejs = require('ejs');
const path = require('path');
const { sendMail } = require('./emailService');
const { normalizeLocale, emailCopy, interpolate } = require('./emailTemplateI18n');

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

async function notifyAdmin(eventType, details, data = {}, options = {}) {
  try {
    const locale = normalizeLocale(options.locale || 'en');
    const localeCopy = emailCopy(locale);
    const copy = localeCopy.admin;
    const baseUrl = resolveBaseUrl();
    const supportEmail = resolveSupportEmail();
    const adminEmail = resolveAdminEmail();
    const adminPanelLink = `${baseUrl}/admin`;
    const logoUrl = `${baseUrl}/albamount.png`;
    const subject = interpolate(copy.subject, { eventType });
    const preheader = interpolate(copy.preheader, { eventType });

    const html = await ejs.renderFile(path.join(__dirname, '../views/emails/admin-notification.ejs'), {
      locale,
      subject,
      preheader,
      logoUrl,
      baseUrl,
      supportEmail,
      eventType,
      details,
      data,
      adminPanelLink,
      copy,
      footerHelpText: localeCopy.emailFooterHelp
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
