// JS for cabinet page: tabs, forms, previews, categories, and card actions.
(function() {
  'use strict';

  function t(key, fallback, vars) {
    if (typeof window.i18nT === 'function') return window.i18nT(key, fallback || key, vars);
    var text = fallback || key;
    if (!vars) return text;
    return String(text).replace(/\{(\w+)\}/g, function (_, k) {
      return vars[k] != null ? String(vars[k]) : '{' + k + '}';
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

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
    initCategorySelector();
    initAlbaModal();
    initReferralModal();
  });

  function initReferralModal() {
    const referralBtn = document.getElementById('referralBtn');
    const referralModal = document.getElementById('referralModal');
    const closeReferralModal = document.getElementById('closeReferralModal');
    const closeReferralModalBtn = document.getElementById('closeReferralModalBtn');
    const referralLinkInput = document.getElementById('referralLink');
    const referralCodeInput = document.getElementById('referralCode');
    const copyReferralLink = document.getElementById('copyReferralLink');
    const copyReferralCode = document.getElementById('copyReferralCode');

    if (!referralBtn || !referralModal) return;

    const bootstrap = window.AppBootstrap && window.AppBootstrap._config
      ? window.AppBootstrap._config
      : {};
    const refCode = (referralCodeInput && referralCodeInput.value.trim())
      || window.USER_REF_CODE
      || bootstrap.userRefCode
      || '';

    if (referralCodeInput && refCode && !referralCodeInput.value) {
      referralCodeInput.value = refCode;
    }

    if (referralLinkInput) {
      const code = (referralCodeInput && referralCodeInput.value.trim()) || refCode;
      referralLinkInput.value = code
        ? `${window.location.origin}/register?ref=${encodeURIComponent(code)}`
        : '';
    }

    function openModal() {
      if (referralLinkInput && referralCodeInput && referralCodeInput.value && !referralLinkInput.value) {
        referralLinkInput.value = `${window.location.origin}/register?ref=${encodeURIComponent(referralCodeInput.value.trim())}`;
      }
      referralModal.style.display = 'block';
    }

    function closeModal() {
      referralModal.style.display = 'none';
    }

    async function copyText(value, button) {
      if (!value) {
        alert(t('referralNotReady', 'Реферальный код ещё не готов. Обновите страницу.'));
        return;
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(value);
        } else {
          const temp = document.createElement('textarea');
          temp.value = value;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
        }
        if (button) {
          const original = button.textContent;
          button.textContent = t('copied', 'Скопировано');
          setTimeout(function() { button.textContent = original; }, 1500);
        }
      } catch (err) {
        console.error('Copy failed:', err);
        alert(t('sendFailed', 'Не удалось скопировать. Скопируйте вручную.'));
      }
    }

    referralBtn.addEventListener('click', openModal);
    if (closeReferralModal) closeReferralModal.addEventListener('click', closeModal);
    if (closeReferralModalBtn) closeReferralModalBtn.addEventListener('click', closeModal);

    window.addEventListener('click', function(event) {
      if (event.target === referralModal) closeModal();
    });

    if (copyReferralLink) {
      copyReferralLink.addEventListener('click', function() {
        copyText(referralLinkInput ? referralLinkInput.value : '', copyReferralLink);
      });
    }
    if (copyReferralCode) {
      copyReferralCode.addEventListener('click', function() {
        copyText(referralCodeInput ? referralCodeInput.value : '', copyReferralCode);
      });
    }
  }

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

        if (targetTab === 'alba' && typeof window.refreshAlbaData === 'function') {
          window.refreshAlbaData();
        }
      });
    });
  }

  function initLogout() {
    const logoutForm = document.getElementById('logoutForm');
    if (!logoutForm) return;

    logoutForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      if (!confirm(t('confirmLogout', 'Are you sure you want to sign out?'))) return;

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
      if (!imagesInput || imagesInput.files.length === 0) {
        msg.textContent = t('needImage', 'Необходимо загрузить хотя бы одно изображение');
        msg.style.color = '#b00020';
        return;
      }

      if (imagesInput.files.length > 5) {
        msg.textContent = t('maxImagesAlert', 'Максимальное количество изображений: 5');
        msg.style.color = '#b00020';
        return;
      }

      if (imagesInput && imagesInput.files.length > 0) {
        for (let i = 0; i < imagesInput.files.length; i++) {
          const file = imagesInput.files[i];
          if (file.size > 20 * 1024 * 1024) {
            msg.textContent = t('fileTooLarge', 'File "{name}" is too large (max 20MB before compression)', { name: file.name });
            msg.style.color = '#b00020';
            return;
          }
        }
      }

      msg.textContent = t('compressing', 'Сжатие и загрузка фото...');
      msg.style.color = '#666';

      const country = (form.querySelector('[name="country"]') || {}).value || '';
      const city = (form.querySelector('[name="city"]') || {}).value || '';
      if (window.AlbamountLocationTags && typeof window.AlbamountLocationTags.commitPending === 'function') {
        window.AlbamountLocationTags.commitPending();
      }
      let tags = [];
      try {
        tags = JSON.parse((form.querySelector('#tagsHidden') || {}).value || '[]');
      } catch (_) {
        tags = [];
      }
      if (!country || !city) {
        msg.textContent = t('locationRequiredMsg', 'Укажите страну и город');
        msg.style.color = '#b00020';
        return;
      }
      if (!Array.isArray(tags) || tags.length < 1) {
        msg.textContent = t('tagRequiredMsg', 'Напишите хештег, например ремонт, и нажмите «Добавить»');
        msg.style.color = '#b00020';
        const tagsFields = document.getElementById('tagsFields');
        if (tagsFields && typeof tagsFields.scrollIntoView === 'function') {
          tagsFields.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        const tagsInput = document.getElementById('tagsInput');
        if (tagsInput) tagsInput.focus();
        return;
      }

      let formData;
      try {
        if (window.ImageUploadCompress && window.ImageUploadCompress.replaceFormDataImages) {
          formData = await window.ImageUploadCompress.replaceFormDataImages(form, 'images');
        } else {
          formData = new FormData(form);
        }
      } catch (compressErr) {
        msg.textContent = t('compressFail', 'Не удалось сжать изображения. Попробуйте другие файлы.');
        msg.style.color = '#b00020';
        return;
      }

      msg.textContent = t('sending', 'Отправка...');

      try {
        const res = await csrfFetch('/cabinet/product', {
          method: 'POST',
          body: formData
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          msg.textContent = (t('error', 'Ошибка') + ': ') + (text || t('badResponse', 'Неверный формат ответа'));
          msg.style.color = '#b00020';
          return;
        }

        const json = await res.json();
        if (json.success) {
          msg.textContent = t('cardPending', 'Карточка отправлена на модерацию.');
          msg.style.color = 'green';
          form.reset();
          const preview = document.getElementById('imagePreview');
          const imagesInput = document.getElementById('images');
          if (imagesInput && typeof imagesInput._clearSelectedImages === 'function') {
            imagesInput._clearSelectedImages();
          } else if (preview) {
            preview.style.display = 'none';
            preview.innerHTML = '';
          }
          setTimeout(() => location.reload(), 800);
        } else {
          msg.textContent = json.message || t('createFail', 'Ошибка при создании карточки');
          msg.style.color = '#b00020';
        }
      } catch (err) {
        console.error('Ошибка при отправке:', err);
        msg.textContent = t('networkError', 'Ошибка сети') + ': ' + err.message;
        msg.style.color = '#b00020';
      }
    });
  }

  function initImagePreview() {
    const imagesInput = document.getElementById('images');
    const imagePreview = document.getElementById('imagePreview');
    if (!imagesInput || !imagePreview) return;

    const maxFiles = parseInt(imagesInput.getAttribute('data-max-files'), 10) || 5;
    /** @type {File[]} */
    let selectedFiles = [];

    function syncInputFiles() {
      const dt = new DataTransfer();
      selectedFiles.forEach(function(file) { dt.items.add(file); });
      imagesInput.files = dt.files;
    }

    function renderPreview() {
      imagePreview.innerHTML = '';
      if (selectedFiles.length === 0) {
        imagePreview.style.display = 'none';
        return;
      }

      imagePreview.style.display = 'grid';
      imagePreview.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
      imagePreview.style.gap = '10px';

      selectedFiles.forEach(function(file) {
        const reader = new FileReader();
        reader.onload = function(loadEvent) {
          const div = document.createElement('div');
          div.className = 'preview-item';
          div.style.position = 'relative';
          div.style.width = '100%';
          div.style.aspectRatio = '1';
          div.style.overflow = 'hidden';
          div.style.borderRadius = '8px';
          div.style.border = '2px solid #ddd';
          div.style.background = '#f5f5f5';

          const img = document.createElement('img');
          img.src = loadEvent.target.result;
          img.alt = file.name;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';
          img.style.display = 'block';

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.textContent = '×';
          removeBtn.setAttribute('aria-label', t('removePhoto', 'Remove photo'));
          removeBtn.style.position = 'absolute';
          removeBtn.style.top = '4px';
          removeBtn.style.right = '4px';
          removeBtn.style.width = '24px';
          removeBtn.style.height = '24px';
          removeBtn.style.border = 'none';
          removeBtn.style.borderRadius = '50%';
          removeBtn.style.background = 'rgba(0,0,0,0.65)';
          removeBtn.style.color = '#fff';
          removeBtn.style.cursor = 'pointer';
          removeBtn.style.lineHeight = '1';
          removeBtn.addEventListener('click', function() {
            selectedFiles = selectedFiles.filter(function(f) { return f !== file; });
            syncInputFiles();
            renderPreview();
          });

          div.appendChild(img);
          div.appendChild(removeBtn);
          imagePreview.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    }

    imagesInput.addEventListener('change', function(e) {
      const incoming = Array.from(e.target.files || []);
      if (!incoming.length) return;

      const next = selectedFiles.slice();
      for (let i = 0; i < incoming.length; i++) {
        const file = incoming[i];
        if (file.size > 20 * 1024 * 1024) {
          alert(t('fileTooLarge', 'File "{name}" is too large (max 20MB before compression)', { name: file.name }));
          continue;
        }
        const duplicate = next.some(function(f) {
          return f.name === file.name && f.size === file.size && f.lastModified === file.lastModified;
        });
        if (!duplicate) next.push(file);
      }

      if (next.length > maxFiles) {
        alert(t('maxImagesCount', 'You can select at most {max} images', { max: maxFiles }));
        selectedFiles = next.slice(0, maxFiles);
      } else {
        selectedFiles = next;
      }

      syncInputFiles();
      renderPreview();
    });

    // Expose clear for successful submit reset
    imagesInput._clearSelectedImages = function() {
      selectedFiles = [];
      syncInputFiles();
      renderPreview();
    };
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

      categorySelect.innerHTML = '<option value="">' + escapeHtml(t('form.selectCategory', 'Select a category')) + '</option>';

      blocks.forEach(function(block) {
        const option = document.createElement('option');
        option.value = String(block._id || block.id);
        option.textContent = `${block.icon || ''} ${block.name}`.trim();
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

      subcategorySelect.innerHTML = '<option value="">' + escapeHtml(t('form.selectCategory', 'Select a category')) + '</option>';

      subcategories.forEach(function(sub) {
        const option = document.createElement('option');
        option.value = String(sub._id || sub.id);
        option.textContent = `${sub.icon || ''} ${sub.name}`.trim();
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
          return String(block._id || block.id) === String(selectedBlockId);
        });
        if (selectedBlock) {
          loadSubcategories(selectedBlockId);
        } else {
          // Leaf or unknown — still try children endpoint
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
      target.classList.contains('edit-service-btn')
    ) {
      const id = target.getAttribute('data-id');
      window.location.href = `/cabinet/product/${id}/edit`;
      return;
    }

    if (target.classList.contains('republish-card-btn')) {
      const id = target.getAttribute('data-id');
      if (!id) return;
      target.disabled = true;
      csrfFetch(`/cabinet/product/${id}/republish`, {
        method: 'POST',
        headers: { Accept: 'application/json' }
      })
        .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
        .then(function (result) {
          if (result.data && result.data.success) {
            alert(t('republishSuccess', result.data.message || 'Sent to moderation'));
            window.location.reload();
            return;
          }
          alert((result.data && result.data.message) || t('republishFail', 'Could not renew publication'));
        })
        .catch(function () {
          alert(t('republishFail', 'Could not renew publication'));
        })
        .finally(function () {
          target.disabled = false;
        });
      return;
    }

    if (target.classList.contains('auto-renew-btn')) {
      const id = target.getAttribute('data-id');
      if (!id) return;
      const currentlyOn = target.getAttribute('data-enabled') === 'true';
      const enabled = !currentlyOn;
      if (enabled && !window.confirm(t(
        'autoRenewConfirm',
        'Allow Albamount to charge 30 ALBA from your balance to extend this card when the publication term ends? If the balance is too low, the card will leave the catalog.'
      ))) {
        return;
      }
      target.disabled = true;
      csrfFetch(`/cabinet/product/${id}/auto-renew`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: enabled })
      })
        .then(function (res) { return res.json().then(function (data) { return { res: res, data: data }; }); })
        .then(function (result) {
          if (result.data && result.data.success) {
            window.location.reload();
            return;
          }
          alert((result.data && result.data.message) || t('autoRenewFail', 'Could not save auto-renew'));
        })
        .catch(function () {
          alert(t('autoRenewFail', 'Could not save auto-renew'));
        })
        .finally(function () {
          target.disabled = false;
        });
      return;
    }

    if (
      target.classList.contains('delete-product-btn') ||
      target.classList.contains('delete-service-btn')
    ) {
      const id = target.getAttribute('data-id');
      if (!confirm(t('confirmDeleteCard', 'Delete card?'))) return;

      const url = `/cabinet/product/${id}`;
      csrfFetch(url, { method: 'DELETE' })
        .then(function(res) { return res.json(); })
        .then(function(data) {
          if (data.success) {
            location.reload();
          } else {
            alert(t('deleteError', 'Delete failed') + ': ' + (data.message || t('unknownError', 'Unknown error')));
          }
        })
        .catch(function(err) {
          console.error('Ошибка:', err);
          alert(t('networkErrorShort', 'Network error'));
        });
    }
  }

  function initAlbaModal() {
    const albaBalanceBtn = document.getElementById('albaBalanceBtn');
    const albaBalanceModal = document.getElementById('albaBalanceModal');
    const closeAlbaModal = document.getElementById('closeAlbaModal');
    const closeAlbaModalBtn = document.getElementById('closeAlbaModalBtn');
    const refreshAlbaModalBtn = document.getElementById('refreshAlbaModalBtn');
    const buyEntitlementBtn = document.getElementById('buyEntitlementBtn');
    const cardTypeSelect = document.getElementById('cardType');
    const cardsToBuyInput = document.getElementById('cardsToBuy');
    const purchaseStatus = document.getElementById('purchaseStatus');
    const totalCostDisplay = document.getElementById('totalCostDisplay');

    if (!albaBalanceBtn || !albaBalanceModal) return;

    // Open modal
    albaBalanceBtn.addEventListener('click', () => {
      albaBalanceModal.style.display = 'block';
      loadAvailableEntitlements();
      if (typeof window.refreshAlbaData === 'function') {
        window.refreshAlbaData();
      }
    });

    // Close modal
    if (closeAlbaModal) {
      closeAlbaModal.addEventListener('click', () => {
        albaBalanceModal.style.display = 'none';
      });
    }

    if (closeAlbaModalBtn) {
      closeAlbaModalBtn.addEventListener('click', () => {
        albaBalanceModal.style.display = 'none';
      });
    }

    // Refresh balance
    if (refreshAlbaModalBtn) {
      refreshAlbaModalBtn.addEventListener('click', async () => {
        try {
          if (typeof window.refreshAlbaData === 'function') {
            await window.refreshAlbaData();
            return;
          }
          const response = await fetch('/api/p1/alba/transactions', {
            credentials: 'same-origin',
            headers: { Accept: 'application/json' }
          });
          const data = await response.json();

          if (data.success) {
            const currentBalance = data.balance || 0;
            updateBalanceDisplays(currentBalance);
          }
        } catch (error) {
          console.error('Error refreshing balance:', error);
        }
      });
    }

    // Update total cost when selection changes
    function updateTotalCost() {
      if (cardTypeSelect && cardsToBuyInput && totalCostDisplay) {
        const cardType = cardTypeSelect.value;
        const cardsToBuy = parseInt(cardsToBuyInput.value) || 1;
        const costPerCard = parseInt(cardTypeSelect.selectedOptions[0]?.dataset?.cost) || 30;
        const totalCost = cardsToBuy * costPerCard;
        totalCostDisplay.textContent = `${totalCost} ALBA`;
      }
    }

    if (cardTypeSelect && cardsToBuyInput) {
      cardTypeSelect.addEventListener('change', updateTotalCost);
      cardsToBuyInput.addEventListener('input', updateTotalCost);
      updateTotalCost();
    }

    // Handle entitlement purchase
    if (buyEntitlementBtn && cardTypeSelect && cardsToBuyInput && purchaseStatus) {
      buyEntitlementBtn.addEventListener('click', async () => {
        // Disable the button to prevent double click
        buyEntitlementBtn.disabled = true;
        buyEntitlementBtn.textContent = t('processing', 'Processing…');
        buyEntitlementBtn.style.opacity = '0.6';

        const cardType = cardTypeSelect.value;
        const cardsToBuy = parseInt(cardsToBuyInput.value) || 1;
        const costPerCard = parseInt(cardTypeSelect.selectedOptions[0]?.dataset?.cost) || 30;
        const totalCost = cardsToBuy * costPerCard;

        // Generate unique idempotency key
        const idempotencyKey = 'ent_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        try {
          // Check current balance
          const balanceResponse = await fetch('/api/p1/alba/transactions');
          const balanceData = await balanceResponse.json();

          let currentBalance = 0;
          if (balanceData.success) {
            currentBalance = balanceData.balance || 0;
          }

          if (currentBalance < totalCost) {
            purchaseStatus.textContent = t('insufficientAlba', 'Not enough ALBA. Required {required}, you have {balance}', {
              required: totalCost,
              balance: currentBalance
            });
            purchaseStatus.style.color = '#ff6666';
            return;
          }

          let purchased = 0;
          let newBalance = currentBalance;
          let lastError = '';

          for (let i = 0; i < cardsToBuy; i++) {
            const key = i === 0 ? idempotencyKey : `${idempotencyKey}_${i}`;
            const response = await csrfFetch('/api/p1/entitlements/purchase', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                type: cardType,
                idempotencyKey: key
              })
            });

            const result = await response.json();
            if (!result.success) {
              lastError = result.message || t('purchaseError', 'Purchase failed');
              break;
            }
            purchased += 1;
            if (typeof result.balance === 'number') {
              newBalance = result.balance;
            } else {
              newBalance = Math.max(0, newBalance - costPerCard);
            }
          }

          const typeLabel = cardType === 'product'
            ? t('typeProduct', 'Product')
            : (cardType === 'service' ? t('typeService', 'Service') : t('typeBanner', 'Banner'));
          if (purchased > 0) {
            purchaseStatus.textContent = t('purchaseSuccess', 'Success! Purchased {count} rights ({type}) for {cost} ALBA', {
              count: purchased,
              type: typeLabel,
              cost: purchased * costPerCard
            });
            purchaseStatus.style.color = '#66ff66';
            updateBalanceDisplays(newBalance);
            loadAvailableEntitlements();
            setTimeout(() => { purchaseStatus.textContent = ''; }, 5000);
          } else {
            purchaseStatus.textContent = lastError || t('purchaseError', 'Purchase failed');
            purchaseStatus.style.color = '#ff6666';
          }
        } catch (error) {
          console.error('Error purchasing entitlement:', error);
          purchaseStatus.textContent = t('networkError', 'Network error') + ': ' + error.message;
          purchaseStatus.style.color = '#ff6666';
        } finally {
          buyEntitlementBtn.disabled = false;
          buyEntitlementBtn.textContent = t('buyEntitlement', 'Buy card publishing right');
          buyEntitlementBtn.style.opacity = '1';
        }
      });
    }

    // Load and display available entitlements
    async function loadAvailableEntitlements() {
      try {
        const response = await fetch('/api/p1/entitlements/available');
        const data = await response.json();

        if (data.success) {
          const entitlements = data.entitlements;
          const entitlementsInfo = document.getElementById('entitlementsInfo');

          if (entitlementsInfo) {
            let html = '<div style="margin-top: 20px; padding: 15px; background: rgba(31, 138, 90, 0.05); border-radius: 8px;">';
            html += '<h4 style="color: #e8d5a3; margin-bottom: 10px;">' + t('availableRights', 'Available rights') + '</h4>';

            if (entitlements.total > 0) {
              html += '<p style="color: #ccc; margin-bottom: 10px;">' + t('youHaveRights', 'You have {count} available rights:', { count: entitlements.total }) + '</p>';
              html += '<ul style="color: #ccc; margin-left: 20px;">';

              if (entitlements.product.length > 0) {
                html += '<li>' + t('adsRights', 'Buy/Sell: {count}', { count: entitlements.product.length }) + '</li>';
              }
              if (entitlements.service.length > 0) {
                html += '<li>' + t('servicesRights', 'Services: {count}', { count: entitlements.service.length }) + '</li>';
              }

              html += '</ul>';
            } else {
              html += '<p style="color: #ccc;">' + t('noRights', 'You have no available rights. Buy rights to create more cards.') + '</p>';
            }

            html += '</div>';
            entitlementsInfo.innerHTML = html;
          }
        }
      } catch (error) {
        console.error('Error loading entitlements:', error);
      }
    }

    // Update balance displays
    function updateBalanceDisplays(balance) {
      const modalBalanceElement = document.getElementById('modalAlbaBalance');
      const footerBalanceElement = document.getElementById('footerAlbaBalance');
      const albaBalanceDisplay = document.getElementById('albaBalanceDisplay');

      if (modalBalanceElement) {
        modalBalanceElement.textContent = `${balance} ALBA`;
      }

      if (footerBalanceElement) {
        footerBalanceElement.textContent = balance.toString();
      }

      if (albaBalanceDisplay) {
        albaBalanceDisplay.textContent = `${balance} ALBA`;
      }
    }

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target === albaBalanceModal) {
        albaBalanceModal.style.display = 'none';
      }
    });
  }
})();
