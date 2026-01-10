module.exports = {
  enabled: process.env.EMAIL_VERIFICATION_ENABLED === 'true',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  },
  from: process.env.EMAIL_FROM || 'noreply@example.com'
};
