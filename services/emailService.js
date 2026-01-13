const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');

// Проверяем, что все необходимые параметры SMTP настроены
if (emailConfig.enabled) {
  if (!emailConfig.smtp.host || !emailConfig.smtp.auth.user || !emailConfig.smtp.auth.pass) {
    console.warn('⚠️ Email service is enabled but SMTP configuration is incomplete.');
    console.warn('Please check your environment variables for SMTP settings.');
  }
}

const transporter = nodemailer.createTransport(emailConfig.smtp);

function checkConfiguration() {
  if (!emailConfig.enabled) {
    console.log('Email service disabled');
    return;
  }

  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP Configuration Error:', error.message);
    } else {
      console.log('✅ SMTP Configuration OK');
    }
  });
}

function sendMail(options) {
  const mailOptions = {
    from: emailConfig.from,
    ...options
  };
  return transporter.sendMail(mailOptions);
}

module.exports = { transporter, checkConfiguration, sendMail };
