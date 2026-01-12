// Единый паттерн для безопасной передачи данных из EJS в JavaScript
// Решает проблемы с "Expression expected" и обеспечивает типобезопасность

window.AppBootstrap = {
  // Безопасная установка булевых значений
  setBoolean: function(key, value) {
    window[key] = Boolean(value);
  },

  // Безопасная установка строковых значений
  setString: function(key, value) {
    window[key] = typeof value === 'string' ? value : String(value || '');
  },

  // Безопасная установка числовых значений
  setNumber: function(key, value) {
    window[key] = typeof value === 'number' && !isNaN(value) ? value : 0;
  },

  // Безопасная установка объектов (с JSON парсингом)
  setObject: function(key, value) {
    try {
      if (typeof value === 'string') {
        window[key] = JSON.parse(value);
      } else if (typeof value === 'object' && value !== null) {
        window[key] = value;
      } else {
        window[key] = {};
      }
    } catch (e) {
      console.warn(`Failed to parse ${key}:`, e);
      window[key] = {};
    }
  },

  // Инициализация всех глобальных переменных
  init: function(config) {
    // Типобезопасная установка переменных
    this.setBoolean('IS_AUTH', config.isAuth);
    this.setBoolean('IS_ADMIN', config.isAdmin);
    this.setBoolean('SOCKET_IO_AVAILABLE', config.socketIoAvailable);

    this.setString('USER_ROLE', config.userRole || null);
    this.setString('CSRF_TOKEN', config.csrfToken || '');

    console.log('AppBootstrap initialized:', {
      IS_AUTH: window.IS_AUTH,
      IS_ADMIN: window.IS_ADMIN,
      SOCKET_IO_AVAILABLE: window.SOCKET_IO_AVAILABLE,
      USER_ROLE: window.USER_ROLE
    });
  }
};
