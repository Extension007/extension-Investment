// JS for cabinet page: tabs, forms, previews, categories, and card actions.
(function() {
  'use strict';

  function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  const csrfFetch = window.csrfFetch || function(url, options = {}) {
    const token = getCsrfToken();
    const headers = options.headers || {};
    if (options.method && options.method.toUpperCase() !== 'GET') {
      headers['X-CSRF-Token'] = token;
    }
    return fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || 'same-origin'
    });
  };

  document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initLogout();
    initProductForm();
    initImagePreview();
    initBannerForm();
    initCategorySelector();
  });

  document.addEventListener('click', function(e) {
    handleCardActions(e);
  });

  function initTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    if (!tabs.length || !tabContents.length) return;

    tabs.forEach(function(tab) {
      tab.addEventListener('click', function() {
        const targetTab = tab.dataset.tab;
        if (!targetTab) return;

        tabs.forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');

        tabContents.forEach(function(content) {
          content.classList.remove('active');
          if (content.id === `tab-${targetTab}`) {
            content.classList.add('active');
          }
        });
      });
    });
  }

  function initLogout() {
    const logoutForm = document.getElementById('logoutForm');
    if (!logoutForm) return;

    logoutForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!confirm('Вы уверены, что хотите выйти?')) return;

      try {
        const res = await csrfFetch('/logout', { method: 'POST' });
        if (res.ok) {
          window.location.href = '/';
        }
      } catch (err) {
        console.error('Ошибка выхода:', err);
        window.location.href = '/';
      }
    });
  }

  function initProductForm() {
    const form = document.getElementById('createProductForm');
    const msg = document.getElementById('createProductMsg');
    if (!form || !msg) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const imagesInput = form.querySelector('input[name="images"]');
      if (imagesInput && imagesInput.files.length > 5) {
        msg.textContent = 'Максимальное количество изображений: 5';
        msg.style.color = '#b00020';
        return;
      }

      if (imagesInput && imagesInput.files.length > 0) {
        for (let i = 0; i < imagesInput.files.length; i++) {
          const file = imagesInput.files[i];
          if (file.size > 5 * 1024 * 1024) {
            msg.textContent = `Файл "${file.name}" превышает 5MB`;
            msg.style.color = '#b00020';
            return;
          }
        }
      }

      msg.textContent = 'Отправка...';
      msg.style.color = '#666';

      const formData = new FormData(form);

      try {
        const res = await csrfFetch('/cabinet/product', {
          method: 'POST',
          body: formData
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          msg.textContent = 'Ошибка: ' + (text || 'Неверный формат ответа');
          msg.style.color = '#b00020';
          return;
        }

        const json = await res.json();
        if (json.success) {
          msg.textContent = 'Карточка отправлена на модерацию.';
          msg.style.color = 'green';
          form.reset();
          const preview = document.getElementById('imagePreview');
          if (preview) preview.style.display = 'none';
          setTimeout(() => location.reload(), 800);
        } else {
          msg.textContent = json.message || 'Ошибка при создании карточки';
          msg.style.color = '#b00020';
        }
      } catch (err) {
        console.error('Ошибка при отправке:', err);
        msg.textContent = 'Ошибка сети: ' + err.message;
        msg.style.color = '#b00020';
      }
    });
  }

  function initImagePreview() {
    const imagesInput = document.getElementById('images');
    const imagePreview = document.getElementById('imagePreview');
    if (!imagesInput || !imagePreview) return;

    imagesInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files || []);
      const maxFiles = parseInt(imagesInput.getAttribute('data-max-files'), 10) || 5;

      if (files.length > maxFiles) {
        alert(`Можно выбрать не более ${maxFiles} изображений`);
        e.target.value = '';
        imagePreview.innerHTML = '';
        imagePreview.style.display = 'none';
        return;
      }

      imagePreview.innerHTML = '';

      if (files.length === 0) {
        imagePreview.style.display = 'none';
        return;
      }

      imagePreview.style.display = 'grid';

      files.forEach(function(file) {
        if (file.size > 5 * 1024 * 1024) {
          alert(`Файл "${file.name}" слишком большой (максимум 5MB)`);
          return;
        }

        const reader = new FileReader();
        reader.onload = function(loadEvent) {
          const div = document.createElement('div');
          div.className = 'preview-item';
          div.style.position = 'relative';
          div.style.aspectRatio = '1';
          div.style.overflow = 'hidden';
          div.style.borderRadius = '8px';
          div.style.border = '2px solid #ddd';

          const img = document.createElement('img');
          img.src = loadEvent.target.result;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';

          div.appendChild(img);
          imagePreview.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function initBannerForm() {
    const bannerForm = document.getElementById('createBannerForm');
    const bannerMsg = document.getElementById('createBannerMsg');
    const bannerPreview = document.getElementById('bannerPreview');
    const bannerPreviewImg = document.getElementById('bannerPreviewImg');
    const bannerImageInput = document.getElementById('bannerImage');

    if (!bannerForm) return;

    if (bannerImageInput && bannerPreviewImg && bannerPreview) {
      bannerImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) {
            alert(`Файл "${file.name}" слишком большой (максимум 5MB)`);
            e.target.value = '';
            bannerPreview.style.display = 'none';
            return;
          }

          const reader = new FileReader();
          reader.onload = function(loadEvent) {
            bannerPreviewImg.src = loadEvent.target.result;
            bannerPreview.style.display = 'block';
          };
          reader.readAsDataURL(file);
        } else if (bannerPreview) {
          bannerPreview.style.display = 'none';
        }
      });
    }

    bannerForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      if (bannerImageInput && bannerImageInput.files.length > 0) {
        const file = bannerImageInput.files[0];
        if (file.size > 5 * 1024 * 1024) {
          bannerMsg.textContent = `Файл "${file.name}" превышает 5MB`;
          bannerMsg.style.color = '#b00020';
          return;
        }
      }

      bannerMsg.textContent = 'Отправка...';
      bannerMsg.style.color = '#666';

      const formData = new FormData(bannerForm);

      try {
        const res = await csrfFetch('/cabinet/banner', {
          method: 'POST',
          body: formData
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          bannerMsg.textContent = 'Ошибка: ' + (text || 'Неверный формат ответа');
          bannerMsg.style.color = '#b00020';
          return;
        }

        const json = await res.json();
        if (json.success) {
          bannerMsg.textContent = 'Баннер отправлен на модерацию.';
          bannerMsg.style.color = 'green';
          bannerForm.reset();
          if (bannerPreview) bannerPreview.style.display = 'none';
          setTimeout(() => location.reload(), 800);
        } else {
          bannerMsg.textContent = json.message || 'Ошибка при загрузке баннера';
          bannerMsg.style.color = '#b00020';
        }
      } catch (err) {
        console.error('Ошибка при отправке:', err);
        bannerMsg.textContent = 'Ошибка сети: ' + err.message;
        bannerMsg.style.color = '#b00020';
      }
    });
  }

  function initCategorySelector() {
    const categorySelect = document.getElementById('categorySelect');
    const subcategorySelector = document.getElementById('subcategorySelector');
    const subcategorySelect = document.getElementById('subcategorySelect');
    const backToBlocksBtn = document.getElementById('backToBlocks');
    const typeSelect = document.getElementById('type');

    if (!categorySelect) return;

    let currentCategories = [];
    let currentType = typeSelect ? typeSelect.value : 'product';

    loadCategoryBlocks();

    if (typeSelect) {
      typeSelect.addEventListener('change', function() {
        currentType = this.value;
        loadCategoryBlocks();
      });
    }

    async function loadCategoryBlocks() {
      try {
        const response = await fetch(`/api/categories/tree/${currentType}`);
        const data = await response.json();

        if (data.success && data.categories) {
          currentCategories = data.categories;
          renderCategoryBlocks(data.categories);
        } else {
          console.error('Ошибка загрузки блоков категорий:', data.message);
        }
      } catch (error) {
        console.error('Ошибка сети при загрузке блоков:', error);
      }
    }

    function renderCategoryBlocks(blocks) {
      if (!categorySelect) return;

      categorySelect.innerHTML = '<option value="">Выберите категорию</option>';

      blocks.forEach(function(block) {
        const option = document.createElement('option');
        option.value = block._id;
        option.textContent = `${block.icon || ''} ${block.name}`;
        categorySelect.appendChild(option);
      });
    }

    async function loadSubcategories(blockId) {
      try {
        const response = await fetch(`/api/categories/children/${blockId}`);
        const data = await response.json();

        if (data.success && data.categories) {
          renderSubcategories(data.categories);
        } else {
          console.error('Ошибка загрузки подкатегорий:', data.message);
        }
      } catch (error) {
        console.error('Ошибка сети при загрузке подкатегорий:', error);
      }
    }

    function renderSubcategories(subcategories) {
      if (!subcategorySelector || !subcategorySelect) return;

      subcategorySelect.innerHTML = '<option value="">Выберите подкатегорию</option>';

      subcategories.forEach(function(sub) {
        const option = document.createElement('option');
        option.value = sub._id;
        option.textContent = `${sub.icon || ''} ${sub.name}`;
        subcategorySelect.appendChild(option);
      });

      subcategorySelector.style.display = 'block';
    }

    function hideSubcategories() {
      if (subcategorySelector) {
        subcategorySelector.style.display = 'none';
      }
    }

    categorySelect.addEventListener('change', function() {
      const selectedBlockId = this.value;
      if (selectedBlockId) {
        const selectedBlock = currentCategories.find(function(block) {
          return block._id === selectedBlockId;
        });
        if (selectedBlock) {
          loadSubcategories(selectedBlockId);
        }
      } else {
        hideSubcategories();
      }
    });

    if (subcategorySelect) {
      subcategorySelect.addEventListener('change', function() {
        const selectedCategoryId = this.value;
        const selectedCategoryName = this.options[this.selectedIndex].text;

        if (selectedCategoryId) {
          let optionExists = false;
          for (let i = 0; i < categorySelect.options.length; i++) {
            if (categorySelect.options[i].value === selectedCategoryId) {
              optionExists = true;
              break;
            }
          }

          if (!optionExists) {
            const newOption = document.createElement('option');
            newOption.value = selectedCategoryId;
            newOption.textContent = selectedCategoryName;
            categorySelect.appendChild(newOption);
          }

          categorySelect.value = selectedCategoryId;
        }
      });
    }

    if (backToBlocksBtn) {
      backToBlocksBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        hideSubcategories();
        categorySelect.value = '';
      });
    }
  }

  function handleCardActions(e) {
    const target = e.target;
    if (!(target instanceof Element)) return;

    if (
      target.classList.contains('edit-product-btn') ||
      target.classList.contains('edit-service-btn') ||
      target.classList.contains('edit-banner-btn')
    ) {
      const id = target.getAttribute('data-id');
      const isBanner = target.classList.contains('edit-banner-btn');
      const url = isBanner ? `/cabinet/banner/${id}/edit` : `/cabinet/product/${id}/edit`;
      window.location.href = url;
      return;
    }

    if (
      target.classList.contains('delete-product-btn') ||
      target.classList.contains('delete-service-btn') ||
      target.classList.contains('delete-banner-btn')
    ) {
      const id = target.getAttribute('data-id');
      const isBanner = target.classList.contains('delete-banner-btn');
      const type = isBanner ? 'баннер' : 'карточку';

      if (!confirm(`Вы уверены, что хотите удалить эту ${type}?`)) return;

      const url = isBanner ? `/cabinet/banner/${id}` : `/cabinet/product/${id}`;
      csrfFetch(url, { method: 'DELETE' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.success) {
            location.reload();
          } else {
            alert('Ошибка удаления: ' + (data.message || 'Неизвестная ошибка'));
          }
        })
        .catch(function(err) {
          console.error('Ошибка:', err);
          alert('Ошибка сети');
        });
    }
  }
})();
