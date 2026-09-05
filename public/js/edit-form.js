// Edit product/service form
(function() {
  'use strict';

  let currentImages = [];
  let formConfig = {};

  function t(key, fallback, vars) {
    if (typeof window.i18nT === 'function') return window.i18nT(key, fallback || key, vars);
    var text = fallback || key;
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : '{' + k + '}';
    });
  }

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const input = document.querySelector('input[name="_csrf"]');
    const metaToken = meta ? String(meta.getAttribute('content') || '').trim() : '';
    const inputToken = input ? String(input.value || '').trim() : '';
    return metaToken || inputToken;
  }

  function applyCsrfToRequest(options) {
    const opts = Object.assign({}, options || {});
    const method = String(opts.method || 'GET').toUpperCase();
    const token = getCsrfToken();
    const headers = new Headers(opts.headers || {});

    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      if (token) {
        headers.set('X-CSRF-Token', token);
        if (opts.body instanceof FormData) {
          if (!String(opts.body.get('_csrf') || '').trim()) {
            opts.body.set('_csrf', token);
          }
        }
      }
    }

    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }

    opts.headers = headers;
    opts.credentials = opts.credentials || 'same-origin';
    return { opts, token, method };
  }

  window.csrfFetch = function(url, options) {
    const prepared = applyCsrfToRequest(options);
    return fetch(url, prepared.opts);
  };

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
      if (!confirm(t('confirmDeleteCardLong', 'Are you sure you want to delete this card? This cannot be undone.'))) {
        return;
      }

      const productId = document.getElementById('productId')?.value;
      const csrfToken = getCsrfToken();

      if (!productId || !csrfToken) {
        const msg = t('missingData', 'Required data is missing. Please refresh the page.');
        if (typeof showToast === 'function') showToast(msg, 'error');
        else alert(msg);
        return;
      }

      deleteBtn.disabled = true;
      deleteBtn.textContent = t('deleting', 'Deleting…');

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
          const okMsg = t('cardDeleted', 'Card deleted');
          if (typeof showToast === 'function') showToast(okMsg, 'success');
          else alert(okMsg);

          const mode = formConfig.mode || 'user';
          const redirectUrl = mode === 'admin' ? '/admin' : '/cabinet';
          setTimeout(() => {
            window.location.href = redirectUrl;
          }, 1000);
        } else {
          deleteBtn.disabled = false;
          deleteBtn.textContent = '🗑️ ' + t('deleteCardBtn', 'Delete card');
          const errMsg = t('deleteError', 'Delete failed') + ': ' + (data.message || t('unknownError', 'Unknown error'));
          if (typeof showToast === 'function') showToast(errMsg, 'error');
          else alert(errMsg);
        }
      } catch (err) {
        deleteBtn.disabled = false;
        deleteBtn.textContent = '🗑️ ' + t('deleteCardBtn', 'Delete card');
        const netMsg = t('networkCheckInternet', 'Network error. Check your internet connection');
        if (typeof showToast === 'function') showToast(netMsg, 'error');
        else alert(netMsg);
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
        removeBtn.setAttribute('aria-label', t('removeImage', 'Remove image') + ' ' + (idx + 1));
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
    const csrfToken = getCsrfToken();

    // Валидация входных данных
    if (!productId || !csrfToken) {
      if (typeof showToast === 'function') {
        showToast(t('missingData', 'Required data is missing. Please refresh the page.'), 'error');
      }
      return;
    }

    console.log("Удаление изображения", { productId, index });

    // Находим элемент по data-image-index атрибуту
    const wrapper = document.querySelector(`.image-wrapper[data-image-index="${index}"]`);
    
    if (!wrapper) {
      if (typeof showToast === 'function') {
        showToast(t('imageNotFound', 'Image element not found'), 'error');
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
          showToast(t('imageDeleted', 'Image deleted'), 'success');
        }
      } else {
        // Rollback: восстанавливаем элемент
        wrapper.style.opacity = '1';
        wrapper.style.pointerEvents = 'auto';
        
        const errorText = await res.text();
        console.error("❌ Ошибка удаления", res.status, errorText);
        
        if (typeof showToast === 'function') {
          showToast(t('imageDeleteError', 'Failed to delete image'), 'error');
        }
      }
    } catch (err) {
      // Rollback: восстанавливаем элемент
      wrapper.style.opacity = '1';
      wrapper.style.pointerEvents = 'auto';
      
      console.error("❌ Ошибка сети", err);
      
      if (typeof showToast === 'function') {
        showToast(t('networkCheckInternet', 'Network error. Check your internet connection'), 'error');
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
        showToast(t('maxImagesDetail', 'Maximum 5 images. Current: {current}, new: {new}', {
          current: currentImages.length,
          new: this.files.length
        }), 'error');
        this.value = '';
        return;
      }

      Array.from(this.files).forEach((file) => {
        if (file.size > 20 * 1024 * 1024) {
          showToast(t('fileTooLarge', 'File "{name}" is too large (max 20MB before compression)', { name: file.name }), 'error');
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
          img.alt = t('preview', 'Preview') + ' ' + file.name;
          
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

      if (window.AlbamountLocationTags && typeof window.AlbamountLocationTags.commitPending === 'function') {
        window.AlbamountLocationTags.commitPending();
      }
      
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
        showToast(t('maxImagesDetail', 'Maximum 5 images. Current: {current}, new: {new}', {
          current: currentImages.length,
          new: fileInput ? fileInput.files.length : 0
        }), 'error');
        return false;
      }

      const msg = document.getElementById('editProductMsg');
      
      if (msg) {
        msg.textContent = t('compressPhotos', 'Compressing photos…');
        msg.style.color = "#666";
        msg.setAttribute('aria-live', 'polite');
      }

      let formData;
      try {
        if (window.ImageUploadCompress && window.ImageUploadCompress.replaceFormDataImages) {
          formData = await window.ImageUploadCompress.replaceFormDataImages(this, 'images');
        } else {
          formData = new FormData(this);
        }
      } catch (compressErr) {
        if (msg) {
          msg.textContent = t('compressFail', 'Could not compress images. Try other files.');
          msg.style.color = "#b00020";
        }
        return;
      }

      if (msg) {
        msg.textContent = t('sending', 'Sending…');
      }
      
      try {
        const csrfToken = getCsrfToken();
        if (!csrfToken) {
          if (msg) {
            msg.textContent = t('csrfMissingAlert', 'Error: security token missing. Please refresh the page.');
            msg.style.color = "#b00020";
          }
          showToast(t('csrfMissingAlert', 'Error: security token missing. Please refresh the page.'), 'error');
          return;
        }
        if (!String(formData.get('_csrf') || '').trim()) {
          formData.set('_csrf', csrfToken);
        }

        let action = form.getAttribute('action');
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
            msg.textContent = t('error', 'Error') + ': ' + (text || t('badResponse', 'Invalid response format'));
            msg.style.color = "#b00020";
          }
          showToast(t('updateFail', 'Failed to update listing'), 'error');
          return;
        }
        
        const data = await res.json();
        
        if (data.success) {
          if (msg) {
            msg.textContent = t('productUpdated', 'Product updated successfully');
            msg.style.color = 'green';
          }
          showToast(t('productUpdated', 'Product updated successfully'), 'success');
          setTimeout(() => {
            const redirectUrl = formConfig.mode === 'admin' ? '/admin' : '/cabinet';
            window.location.href = redirectUrl;
          }, 1500);
        } else {
          if (msg) {
            msg.textContent = data.message || t('updateFail', 'Failed to update listing');
            msg.style.color = '#b00020';
          }
          showToast(data.message || t('updateFail', 'Failed to update listing'), 'error');
        }
      } catch (err) {
        if (msg) {
          msg.textContent = t('networkError', 'Network error') + ': ' + err.message;
          msg.style.color = '#b00020';
        }
        showToast(t('networkError', 'Network error') + ': ' + err.message, 'error');
      }
    });
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
