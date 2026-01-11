const emailService = require('./emailService');
const ejs = require('ejs');
const path = require('path');

async function notifyAdmin(eventType, details, data = {}) {
  try {
    const subject = `Уведомление: ${eventType}`;
    
    const html = await ejs.renderFile(path.join(__dirname, '../views/emails/admin-notification.ejs'), {
      eventType,
      details,
      data,
      adminPanelLink: `${process.env.BASE_URL || 'http://localhost:3000'}/admin`
    });
    
    await emailService.sendMail({
      to: 'admin@albamount.xyz',
      subject,
      html
    });
    console.log(`✅ Уведомление администратору отправлено: ${subject}`);
  } catch (error) {
    console.error('❌ Ошибка при отправке уведомления администратору:', error);
  }
}

module.exports = { notifyAdmin };