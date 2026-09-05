let notificationService = null;
try { notificationService = require('./notificationService'); } catch (_) { notificationService = null; }

async function notifyUser(userId, payload) {
  try {
    if (notificationService?.notifyUser) return await notificationService.notifyUser(userId, payload);
  } catch (_) {}
}
module.exports = { notifyUser };
