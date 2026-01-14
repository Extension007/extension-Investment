// Универсальная обработка CSRF для всех POST-запросов
(function() {
  'use strict';

  // Получить CSRF-токен из <meta name="csrf-token">
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  // Обертка для fetch с автоматическим добавлением CSRF-токена
  window.csrfFetch = function(url, options = {}) {
    const csrfToken = getCsrfToken();
    options.headers = options.headers || {};
    // Добавляем токен только для небезопасных методов
    if (options.method && options.method.toUpperCase() !== 'GET') {
      options.headers['X-CSRF-Token'] = csrfToken;
    }
    // Всегда отправляем куки
    options.credentials = options.credentials || 'same-origin';
    return fetch(url, options);
  };

  // Пример: перехват стандартных форм регистрации/голосования
  document.addEventListener('DOMContentLoaded', function() {
    // Пример для формы регистрации
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
      registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = new FormData(registerForm);
        window.csrfFetch('/register', {
          method: 'POST',
          body: formData
        })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            window.location.href = '/cabinet';
          } else {
            alert(data.message || 'Ошибка регистрации');
          }
        })
        .catch(() => alert('Ошибка сети или сервера'));
      });
    }
  });
})();
