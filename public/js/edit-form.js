// Управление формой редактирования товара
(function() {
  'use strict';

  let currentImages = [];
  let formConfig = {};

  // Функция для перепривязки обработчиков удаления
  function reattachDeleteHandlers() {
    const buttons = document.querySelectorAll('.image-delete-button');
    console.log(`🔗 Привязка обработчиков удаления для ${buttons.length} кнопок`);
    
    buttons.forEach((btn) => {
      // Удаляем старые обработчики через клонирование
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Берем индекс из data-атрибута кнопки
      const index = parseInt(newBtn.getAttribute('data-image-index'), 10);
      
      if (isNaN(index)) {
        console.warn('⚠️ Неверный индекс в data-image-index:', newBtn.getAttribute('data-image-index'));
        return;
      }
      
      // Привязываем обработчик
      newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log(`🖱️ Клик по кнопке удаления, индекс: ${index}`);
        removeImageByIndex(index);
      });
    });
    
    console.log(`✅ Обработчики удаления привязаны для ${buttons.length} кнопок`);
  }

  // Навешиваем обработчики на все кнопки удаления изображений после загрузки DOM
  document.addEventListener('DOMContentLoaded', () => {
    reattachDeleteHandlers();
  });

  // Инициализация формы
  function initEditForm(config) {
    formConfig = config || {};
    // Делаем formConfig доступным глобально через window
    window.formConfig = formConfig;
    
    const form = document.getElementById('editProductForm');
    if (!form) {
      console.error('❌ Форма editProductForm не найдена');
      return;
    }

    // Получаем текущие изображения из скрытого поля или конфига
    const currentImagesInput = document.getElementById('currentImagesInput');
    if (currentImagesInput && currentImagesInput.value) {
      try {
        currentImages = JSON.parse(currentImagesInput.value);
      } catch (e) {
        console.warn('⚠️ Ошибка парсинга currentImagesInput, используем конфиг:', e);
        currentImages = formConfig.currentImages || [];
      }
    } else {
      currentImages = formConfig.currentImages || [];
    }

    // Если productId не передан в конфиге, пытаемся получить из формы
    if (!formConfig.productId) {
      const formAction = form.getAttribute('action') || form.action;
      const match = formAction.match(/\/product\/([^\/]+)\//);
      if (match) {
        formConfig.productId = match[1];
        window.formConfig.productId = match[1];
        console.log('✅ productId получен из action формы:', formConfig.productId);
      }
    }

    console.log('✅ Инициализация формы', {
      productId: formConfig.productId,
      mode: formConfig.mode,
      imagesCount: currentImages.length,
      config: formConfig
    });

    // Перепривязываем обработчики на случай, если кнопки были добавлены динамически
    reattachDeleteHandlers();
    
    initFileInput();
    initFormSubmit();
    initDeleteProductButton();
    
    console.log('✅ Все обработчики инициализированы');
  }

  // Функция для инициализации кнопки удаления карточки
  function initDeleteProductButton() {
    const deleteBtn = document.getElementById('deleteProductBtn');
    if (!deleteBtn) {
      console.warn('⚠️ Кнопка удаления карточки не найдена');
      return;
    }

    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Вы уверены, что хотите удалить карточку товара? Это действие нельзя отменить.')) {
        return;
      }

      const productId = document.getElementById('productId')?.value;
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

      if (!productId || !csrfToken) {
        console.error('❌ Нет productId или CSRF токена');
        if (typeof showToast === 'function') {
          showToast('Ошибка: отсутствуют необходимые данные', 'error');
        } else {
          alert('Ошибка: отсутствуют необходимые данные');
        }
        return;
      }

      console.log('🗑️ Удаление карточки товара', { productId });

      // Блокируем кнопку
      deleteBtn.disabled = true;
      deleteBtn.textContent = 'Удаление...';

      try {
        const apiUrl = window.location.origin + `/api/products/${productId}`;
        const res = await window.csrfFetch(apiUrl, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const data = await res.json();

        if (data.success) {
          console.log('✅ Карточка успешно удалена');
          
          if (typeof showToast === 'function') {
            showToast('✅ Карточка удалена', 'success');
          } else {
            alert('✅ Карточка успешно удалена');
          }

          // Определяем URL для редиректа в зависимости от режима
          const mode = formConfig.mode || 'user';
          const redirectUrl = mode === 'admin' ? '/admin' : '/cabinet';
          
          // Небольшая задержка для показа сообщения
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1000);
        } else {
          console.error('❌ Ошибка удаления карточки', data.message);
          deleteBtn.disabled = false;
          deleteBtn.textContent = '🗑️ Удалить карточку';
          
          if (typeof showToast === 'function') {
            showToast('❌ Ошибка удаления: ' + (data.message || 'Неизвестная ошибка'), 'error');
          } else {
            alert('❌ Ошибка удаления: ' + (data.message || 'Неизвестная ошибка'));
          }
        }
      } catch (err) {
        console.error('❌ Ошибка сети при удалении карточки', err);
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️ Удалить карточку';
        
        if (typeof showToast === 'function') {
          showToast('❌ Ошибка сети. Проверьте подключение к интернету', 'error');
        } else {
          alert('❌ Ошибка сети. Проверьте подключение к интернету');
        }
      }
    });

    console.log('✅ Обработчик кнопки удаления карточки привязан');
  }

  // Функция для обновления индексов в DOM после удаления
  function updateImageIndexes() {
    const container = document.querySelector('.current-images-container');
    if (!container) return;
    
    const items = container.querySelectorAll('.current-image-item');
    items.forEach((item, idx) => {
      item.setAttribute('data-image-index', idx);
      // Обновляем оба класса кнопок
      const removeBtn = item.querySelector('.remove-image-btn') || item.querySelector('.image-delete-button');
      if (removeBtn) {
        removeBtn.setAttribute('data-image-index', idx);
        removeBtn.setAttribute('aria-label', `Удалить изображение ${idx + 1}`);
      }
    });
  }

  // Обновление скрытого поля с текущими изображениями
  function updateCurrentImages() {
    const input = document.getElementById('currentImagesInput');
    if (input) {
      // Получаем актуальные URL из DOM (на случай, если что-то изменилось)
      const container = document.querySelector('.current-images-container');
      if (container) {
        const imageItems = container.querySelectorAll('.current-image-item img');
        const actualUrls = Array.from(imageItems).map(img => {
          // Берем src, но если есть data-original-url, используем его (для Cloudinary без параметров)
          return img.getAttribute('data-original-url') || img.src;
        });
        
        // Обновляем массив currentImages актуальными URL
        if (actualUrls.length > 0) {
          currentImages = actualUrls;
        }
      }
      
      input.value = JSON.stringify(currentImages);
      console.log('✅ Обновлено скрытое поле current_images. Осталось изображений:', currentImages.length);
      console.log('📋 Актуальные URL:', currentImages);
    } else {
      console.error('❌ Поле currentImagesInput не найдено!');
    }
  }

  // Функция для удаления изображения по индексу
  async function removeImageByIndex(index) {
    const productId = document.querySelector('#productId')?.value;
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    // Валидация входных данных
    if (!productId || !csrfToken) {
      console.error("❌ Нет productId или CSRF токена", { productId: !!productId, csrfToken: !!csrfToken });
      if (typeof showToast === 'function') {
        showToast('Ошибка: отсутствуют необходимые данные. Обновите страницу', 'error');
      }
      return;
    }

    console.log("Удаление изображения", { productId, index });

    // Находим элемент по data-image-index атрибуту
    const wrapper = document.querySelector(`.image-wrapper[data-image-index="${index}"]`);
    
    if (!wrapper) {
      console.error('❌ Элемент изображения не найден по индексу:', index);
      if (typeof showToast === 'function') {
        showToast('Ошибка: элемент изображения не найден', 'error');
      }
      return;
    }

    // Оптимистичное обновление UI
    wrapper.style.opacity = '0.5';
    wrapper.style.pointerEvents = 'none';

    try {
      const apiUrl = window.location.origin + `/api/images/${productId}/${index}`;
      const res = await window.csrfFetch(apiUrl, {
        method: 'DELETE'
      });

      if (res.ok || res.status === 204) {
        console.log("✅ Изображение удалено");
        
        // Удаляем элемент из DOM
        wrapper.remove();
        
        // Обновляем индексы в DOM
        updateImageIndexes();
        
        // Обновляем скрытое поле с текущими изображениями
        updateCurrentImages();
        
        // Перепривязываем обработчики с обновленными индексами
        reattachDeleteHandlers();
        
        if (typeof showToast === 'function') {
          showToast('Изображение успешно удалено', 'success');
        }
      } else {
        // Rollback: восстанавливаем элемент
        wrapper.style.opacity = '1';
        wrapper.style.pointerEvents = 'auto';
        
        const errorText = await res.text();
        console.error("❌ Ошибка удаления", res.status, errorText);
        
        if (typeof showToast === 'function') {
          showToast('Ошибка при удалении изображения', 'error');
        }
      }
    } catch (err) {
      // Rollback: восстанавливаем элемент
      wrapper.style.opacity = '1';
      wrapper.style.pointerEvents = 'auto';
      
      console.error("❌ Ошибка сети", err);
      
      if (typeof showToast === 'function') {
        showToast('Ошибка сети. Проверьте подключение к интернету', 'error');
      }
    }
  }


  // Инициализация input для загрузки файлов
  function initFileInput() {
    const fileInput = document.getElementById('images');
    if (!fileInput) return;

    fileInput.addEventListener('change', function(e) {
      const preview = document.getElementById('imagePreview');
      if (!preview) return;
      
      preview.innerHTML = '';
      
      const totalImages = currentImages.length + this.files.length;
      if (totalImages > 5) {
        showToast('Максимальное количество изображений: 5. Текущих: ' + currentImages.length + ', новых: ' + this.files.length, 'error');
        this.value = '';
        return;
      }

      Array.from(this.files).forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          showToast(`Файл "${file.name}" превышает размер 5MB`, 'error');
          return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          const div = document.createElement('div');
          div.style.position = 'relative';
          div.style.aspectRatio = '1';
          div.style.overflow = 'hidden';
          div.style.borderRadius = '8px';
          div.style.border = '2px solid #ddd';
          
          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.alt = 'Предпросмотр ' + file.name;
          
          div.appendChild(img);
          preview.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // Инициализация отправки формы
  function initFormSubmit() {
    const form = document.getElementById('editProductForm');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();
      
      // ВАЖНО: Обновляем скрытое поле с актуальным списком изображений перед отправкой
      // Это гарантирует, что в req.body.current_images будет актуальный массив
      updateCurrentImages();
      
      // Дополнительная проверка: логируем что отправляется
      const currentImagesInput = document.getElementById('currentImagesInput');
      if (currentImagesInput) {
        try {
          const imagesToSend = JSON.parse(currentImagesInput.value);
          console.log('📤 Отправка формы с изображениями:', imagesToSend.length, imagesToSend);
        } catch (e) {
          console.error('❌ Ошибка парсинга current_images перед отправкой:', e);
        }
      }
      
      const fileInput = document.getElementById('images');
      const totalImages = currentImages.length + (fileInput ? fileInput.files.length : 0);
      
      if (totalImages > 5) {
        showToast('Максимальное количество изображений: 5. Текущих: ' + currentImages.length + ', новых: ' + (fileInput ? fileInput.files.length : 0), 'error');
        return false;
      }

      const formData = new FormData(this);
      const msg = document.getElementById('editProductMsg');
      
      if (msg) {
        msg.textContent = "Отправка...";
        msg.style.color = "#666";
        msg.setAttribute('aria-live', 'polite');
      }
      
      try {
        let action = form.getAttribute('action');
        // Убедимся, что используем правильный протокол (соответствующий текущей странице)
        if (action.startsWith('//')) {
          action = window.location.protocol + action;
        } else if (action.startsWith('/')) {
          action = window.location.origin + action;
        }
        
        const res = await window.csrfFetch(action, {
          method: 'POST',
          body: formData
        });
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          const text = await res.text();
          console.error("❌ Ответ не JSON:", text);
          if (msg) {
            msg.textContent = "Ошибка: " + (text || "Неверный формат ответа");
            msg.style.color = "#b00020";
          }
          showToast("Ошибка при обновлении товара", 'error');
          return;
        }
        
        const data = await res.json();
        
        if (data.success) {
          if (msg) {
            msg.textContent = 'Товар успешно обновлен!';
            msg.style.color = 'green';
          }
          showToast('Товар успешно обновлен!', 'success');
          setTimeout(() => {
            const redirectUrl = formConfig.mode === 'admin' ? '/admin' : '/cabinet';
            window.location.href = redirectUrl;
          }, 1500);
        } else {
          if (msg) {
            msg.textContent = data.message || 'Ошибка при обновлении товара';
            msg.style.color = '#b00020';
          }
          showToast(data.message || 'Ошибка при обновлении товара', 'error');
        }
      } catch (err) {
        if (msg) {
          msg.textContent = 'Ошибка сети: ' + err.message;
          msg.style.color = '#b00020';
        }
        showToast('Ошибка сети: ' + err.message, 'error');
      }
    });
  }

  // Вспомогательная функция для получения CSRF токена
  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const input = document.querySelector('input[name="_csrf"]');
    const token = meta ? meta.getAttribute('content') : (input ? input.value : '');
    
    if (!token) {
      console.error('❌ CSRF токен не найден!', {
        metaExists: !!meta,
        inputExists: !!input,
        metaContent: meta ? meta.getAttribute('content') : null,
        inputValue: input ? input.value : null
      });
    } else {
      console.log('✅ CSRF токен получен', { 
        source: meta ? 'meta' : 'input',
        length: token.length 
      });
    }
    
    return token;
  }

  // Toast уведомления
  function showToast(message, type = 'info') {
    // Проверяем, есть ли уже toast контейнер
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;display:flex;flex-direction:column;gap:10px;';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    toast.style.cssText = `
      padding: 12px 20px;
      background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
      color: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 250px;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;

    // Добавляем анимацию
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    toastContainer.appendChild(toast);

    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 5000);
  }

  // Экспорт функций для тестирования
  window.initEditForm = initEditForm;
  window.removeImageByIndex = removeImageByIndex;

  // Автоматическая инициализация при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Инициализация будет вызвана из inline скрипта в шаблоне
    });
  }
})();
