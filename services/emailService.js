const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');

const transporter = nodemailer.createTransport(emailConfig.smtp);

function checkConfiguration() {
  if (!emailConfig.enabled) {
    console.log('Email service disabled');
    return;
  }

  transporter.verify((error, success) => {
    if (error) {
      console.log('SMTP Error:', error.message);
    } else {
      console.log('SMTP OK');
    }
  });
}

module.exports = { transporter, checkConfiguration };
