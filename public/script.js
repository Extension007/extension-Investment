// =======================
// Вспомогательные функции
// =======================

// FIX: Извлечение videoId из разных форматов ссылок YouTube
function extractVideoId(url) {
  if (!url) return null;
  if (url.includes('/embed/')) return url.split('/embed/')[1].split(/[?#]/)[0];
  if (url.includes('/shorts/')) return url.split('/shorts/')[1].split(/[?#]/)[0];
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?#]/)[0];
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

// FIX: Формирование URL для YouTube embed без autoplay (избегаем ошибку 153)
function buildYouTubeEmbedUrl(videoId) {
  if (!videoId) return '';
  return `https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&modestbranding=1`;
}

// =======================
// Обработчики видео overlay, регистрация, категории, рейтинг
// =======================

document.addEventListener("DOMContentLoaded", () => {
  // Инициализация состояния голосования для гостей (проверка cookie)
  if (!window.IS_AUTH) {
    document.querySelectorAll(".product-rating").forEach(ratingBlock => {
      const productId = ratingBlock.dataset.id;
      if (productId) {
        const voteCookie = document.cookie.split(';').some(cookie => cookie.trim().startsWith(`exto_vote_${productId}=`));
        if (voteCookie) {
          ratingBlock.dataset.voted = "true";
          ratingBlock.querySelectorAll("button").forEach((b) => {
            b.disabled = true;
          });
        }
      }
    });
  }
  // FIX: Полноэкранный overlay для YouTube видео
  const videoOverlay = document.getElementById('videoOverlay');
  const videoIframeContainer = document.getElementById('videoIframeContainer');
  let currentVideoIframe = null;
  let currentVideoUrl = null;

  // FIX: Overlay для просмотра изображений
  const imageOverlay = document.getElementById('imageOverlay');
  const imageOverlayImg = document.getElementById('imageOverlayImg');
  
  // FIX: Модальное окно для просмотра изображений
  const imageModal = document.getElementById('imageModal');
  const imageModalImage = document.getElementById('imageModalImage');
  const imageModalCurrent = document.getElementById('imageModalCurrent');
  const imageModalTotal = document.getElementById('imageModalTotal');
  const imageModalTitle = document.getElementById('imageModalTitle');
  
  let currentImageIndex = 0;
  let currentImages = [];
  let currentProductName = '';
  
  // FIX: Функция открытия видео overlay
  function openVideoOverlay(videoUrl) {
    if (!videoUrl) return;
    
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      // FIX: Fallback - открываем в новой вкладке если не удалось извлечь ID
      window.open(videoUrl, '_blank');
      return;
    }
    
    currentVideoUrl = videoUrl;
    
    // FIX: Очищаем предыдущий iframe
    if (currentVideoIframe) {
      currentVideoIframe.src = '';
      currentVideoIframe = null;
    }
    videoIframeContainer.innerHTML = '';
    
    // FIX: Создаем новый iframe
    const iframe = document.createElement('iframe');
    iframe.src = buildYouTubeEmbedUrl(videoId);
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('playsinline', '1');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('frameborder', '0');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.style.display = 'block';
    
    // FIX: Обработчик ошибки загрузки iframe
    iframe.onerror = function() {
      // FIX: Fallback - открываем в новой вкладке при ошибке
      window.open(currentVideoUrl, '_blank');
      closeVideoOverlay();
    };
    
    videoIframeContainer.appendChild(iframe);
    currentVideoIframe = iframe;
    
    // FIX: Показываем overlay
    videoOverlay.classList.add('show');
    videoOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  
  // FIX: Функция закрытия видео overlay
  function closeVideoOverlay() {
    // FIX: Очищаем src у iframe для остановки воспроизведения
    if (currentVideoIframe) {
      currentVideoIframe.src = '';
      currentVideoIframe = null;
    }
    videoIframeContainer.innerHTML = '';
    currentVideoUrl = null;
    
    // FIX: Скрываем overlay
    videoOverlay.classList.remove('show');
    videoOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }
  
  // FIX: Функция открытия overlay с изображением (старый вариант)
  function openImageOverlay(imageSrc, imageIndex, images, productId) {
    currentImages = images;
    currentImageIndex = imageIndex;
    if (imageOverlay && imageOverlayImg) {
      imageOverlayImg.src = imageSrc;
      imageOverlayImg.alt = `Изображение ${imageIndex + 1} из ${images.length}`;
      imageOverlay.classList.add('show');
      imageOverlay.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  // FIX: Функция открытия модального окна с изображением
  function openImageModal(imageSrc, imageIndex, images, productName) {
    currentImages = images || [imageSrc];
    currentImageIndex = imageIndex || 0;
    currentProductName = productName || '';
    
    if (imageModal && imageModalImage) {
      imageModalImage.src = currentImages[currentImageIndex];
      imageModalImage.alt = `${productName} - изображение ${currentImageIndex + 1}`;
      
      if (imageModalCurrent) {
        imageModalCurrent.textContent = currentImageIndex + 1;
      }
      if (imageModalTotal) {
        imageModalTotal.textContent = currentImages.length;
      }
      if (imageModalTitle) {
        imageModalTitle.textContent = productName;
      }
      
      imageModal.style.display = 'flex';
      imageModal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  }

  // FIX: Функция закрытия overlay с изображением
  function closeImageOverlay() {
    if (imageOverlay) {
      imageOverlay.classList.remove('show');
      imageOverlay.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    currentImages = [];
    currentImageIndex = 0;
  }

  // FIX: Функция закрытия модального окна с изображением
  function closeImageModal() {
    if (imageModal) {
      imageModal.style.display = 'none';
      imageModal.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    currentImages = [];
    currentImageIndex = 0;
    currentProductName = '';
  }

  // FIX: Функция переключения изображения в overlay
  function navigateImage(direction) {
    if (currentImages.length === 0) return;
    if (direction === 'next') {
      currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    } else if (direction === 'prev') {
      currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    }
    
    // Обновляем overlay (старый вариант)
    if (imageOverlay && imageOverlayImg) {
      imageOverlayImg.src = currentImages[currentImageIndex];
      imageOverlayImg.alt = `Изображение ${currentImageIndex + 1} из ${currentImages.length}`;
    }
    
    // Обновляем модальное окно (новый вариант)
    if (imageModal && imageModalImage) {
      imageModalImage.src = currentImages[currentImageIndex];
      imageModalImage.alt = `${currentProductName} - изображение ${currentImageIndex + 1}`;
      if (imageModalCurrent) {
        imageModalCurrent.textContent = currentImageIndex + 1;
      }
    }
  }

  // FIX: Инициализация слайдера изображений
  function initImageSliders() {
    const sliders = document.querySelectorAll('.product-images-slider');
    sliders.forEach(slider => {
      const images = slider.querySelectorAll('.product-image-slide');
      if (images.length <= 1) return;

      const prevBtn = slider.querySelector('.slider-arrow-prev');
      const nextBtn = slider.querySelector('.slider-arrow-next');
      const indicators = slider.querySelectorAll('.slider-indicator');
      let currentIndex = 0;

      // FIX: Функция переключения слайда
      function goToSlide(index) {
        images.forEach((img, idx) => {
          img.classList.toggle('active', idx === index);
        });
        indicators.forEach((ind, idx) => {
          ind.classList.toggle('active', idx === index);
        });
        currentIndex = index;
      }

      // FIX: Обработчики стрелок
      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide((currentIndex - 1 + images.length) % images.length);
        });
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide((currentIndex + 1) % images.length);
        });
      }

      // FIX: Обработчики индикаторов
      indicators.forEach((ind, idx) => {
        ind.addEventListener('click', (e) => {
          e.stopPropagation();
          goToSlide(idx);
        });
      });

      // FIX: Обработчик клика на изображение для открытия в модальном окне
      images.forEach((img, idx) => {
        img.addEventListener('click', () => {
          // Пытаемся получить массив изображений из data-атрибута
          let allImages = [];
          try {
            const imagesData = img.getAttribute('data-product-images');
            if (imagesData) {
              allImages = JSON.parse(imagesData);
            } else {
              allImages = Array.from(images).map(i => i.getAttribute('data-image-src') || i.src);
            }
          } catch (e) {
            allImages = Array.from(images).map(i => i.getAttribute('data-image-src') || i.src);
          }
          
          const productName = img.getAttribute('data-product-name') || '';
          const imageSrc = img.getAttribute('data-image-src') || img.src;
          
          // Используем новое модальное окно
          if (imageModal) {
            openImageModal(imageSrc, idx, allImages, productName);
          } else if (imageOverlay) {
            // Fallback на старое overlay
            const productId = slider.getAttribute('data-product-id');
            openImageOverlay(imageSrc, idx, allImages, productId);
          }
        });
      });

      // FIX: Поддержка свайпа на мобильных устройствах
      let touchStartX = 0;
      let touchEndX = 0;
      let touchStartY = 0;
      let touchEndY = 0;

      slider.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      slider.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
      }, { passive: true });

      function handleSwipe() {
        const swipeThreshold = 50;
        const diffX = touchStartX - touchEndX;
        const diffY = touchStartY - touchEndY;
        
        // FIX: Проверяем, что свайп горизонтальный (не вертикальный)
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > swipeThreshold) {
          if (diffX > 0) {
            // Свайп влево - следующее изображение
            goToSlide((currentIndex + 1) % images.length);
          } else {
            // Свайп вправо - предыдущее изображение
            goToSlide((currentIndex - 1 + images.length) % images.length);
          }
        }
      }

      // FIX: Поддержка клавиатурной навигации для слайдера (если фокус на карточке)
      const productCard = slider.closest('.product-card');
      if (productCard) {
        productCard.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft') {
            e.preventDefault();
            goToSlide((currentIndex - 1 + images.length) % images.length);
          } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            goToSlide((currentIndex + 1) % images.length);
          }
        });
      }
    });
  }

  // FIX: Клавиатурная навигация для модального окна изображений
  document.addEventListener('keydown', (e) => {
    if (!imageModal || imageModal.style.display === 'none') return;
    
    if (e.key === 'Escape') {
      closeImageModal();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateImage('prev');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateImage('next');
    }
  });

  // FIX: Инициализация всех компонентов
  initImageSliders();

  // FIX: Обработчик клика на кнопку "Обзор" и закрытия overlay
  document.addEventListener('click', (e) => {
    // FIX: Открытие видео по клику на кнопку "Обзор"
    const videoBtn = e.target.closest('.btn[data-video]');
    if (videoBtn) {
      e.preventDefault();
      e.stopPropagation();
      const videoUrl = videoBtn.getAttribute('data-video');
      if (videoUrl) {
        openVideoOverlay(videoUrl);
      }
      return;
    }
    
    // FIX: Закрытие видео overlay по кнопке закрытия
    if (e.target.closest('[data-close-video]')) {
      e.preventDefault();
      e.stopPropagation();
      closeVideoOverlay();
      return;
    }
    
    // FIX: Обработчик клика на баннеры для открытия в overlay (но не на кнопку ссылки)
    if (e.target.closest('.banner-link-icon')) {
      // Клик на кнопку ссылки - не обрабатываем, позволяем перейти по ссылке
      return;
    }
    
    if (e.target.classList.contains('banner-clickable')) {
      e.preventDefault();
      e.stopPropagation();
      const bannerImage = e.target.getAttribute('data-banner-image') || e.target.src;
      if (bannerImage && imageOverlay && imageOverlayImg) {
        currentImages = [bannerImage];
        currentImageIndex = 0;
        openImageOverlay(bannerImage, 0, [bannerImage], null);
      }
      return;
    }
    
    // FIX: Обработчик клика на изображения с классом image-clickable
    if (e.target.classList.contains('image-clickable')) {
      e.preventDefault();
      e.stopPropagation();
      const img = e.target;
      let allImages = [];
      try {
        const imagesData = img.getAttribute('data-product-images');
        if (imagesData) {
          allImages = JSON.parse(imagesData);
        } else {
          allImages = [img.getAttribute('data-image-src') || img.src];
        }
      } catch (e) {
        allImages = [img.getAttribute('data-image-src') || img.src];
      }
      
      const imageIndex = parseInt(img.getAttribute('data-image-index')) || 0;
      const productName = img.getAttribute('data-product-name') || '';
      const imageSrc = img.getAttribute('data-image-src') || img.src;
      
      if (imageModal) {
        openImageModal(imageSrc, imageIndex, allImages, productName);
      }
      return;
    }
    
    // FIX: Закрытие модального окна изображений
    if (e.target.closest('[data-close-image]')) {
      e.preventDefault();
      e.stopPropagation();
      closeImageModal();
      return;
    }
    
    // FIX: Навигация по изображениям в модальном окне
    if (e.target.closest('.image-nav-prev')) {
      e.preventDefault();
      e.stopPropagation();
      navigateImage('prev');
      return;
    }
    
    if (e.target.closest('.image-nav-next')) {
      e.preventDefault();
      e.stopPropagation();
      navigateImage('next');
      return;
    }
    
    // FIX: Закрытие модального окна по клику на фон
    if (e.target === imageModal) {
      closeImageModal();
      return;
    }
    
    // FIX: Закрытие видео overlay по клику на фон
    if (e.target === videoOverlay) {
      closeVideoOverlay();
      return;
    }

    // FIX: Закрытие изображения overlay по кнопке закрытия
    if (e.target.closest('[data-close-image]')) {
      e.preventDefault();
      e.stopPropagation();
      closeImageOverlay();
      return;
    }

    // FIX: Закрытие изображения overlay по клику на фон
    if (e.target === imageOverlay) {
      closeImageOverlay();
      return;
    }

    // FIX: Навигация по изображениям в overlay
    const imageNavBtn = e.target.closest('[data-image-nav]');
    if (imageNavBtn) {
      e.preventDefault();
      e.stopPropagation();
      const direction = imageNavBtn.getAttribute('data-image-nav');
      navigateImage(direction);
      return;
    }
  });

  // FIX: Поддержка клавиатурной навигации в overlay изображений
  document.addEventListener('keydown', (e) => {
    if (!imageOverlay.classList.contains('show')) return;
    
    if (e.key === 'Escape') {
      closeImageOverlay();
    } else if (e.key === 'ArrowLeft') {
      navigateImage('prev');
    } else if (e.key === 'ArrowRight') {
      navigateImage('next');
    }
  });

  // ====== Регистрация ======
  const registerModal = document.getElementById("registerModal");
  const openRegisterBtn = document.getElementById("openRegister");
  const closeRegisterBtn = document.querySelector("[data-close-register]");
  const registerForm = document.getElementById("registerForm");
  const registerError = document.getElementById("registerError");
  const registerSuccess = document.getElementById("registerSuccess");

  if (openRegisterBtn && registerModal) {
    openRegisterBtn.addEventListener("click", () => {
      registerModal.style.display = "block";
      registerModal.setAttribute("aria-hidden", "false");
    });

    if (closeRegisterBtn) {
      closeRegisterBtn.addEventListener("click", () => {
        registerModal.style.display = "none";
        registerModal.setAttribute("aria-hidden", "true");
        if (registerError) registerError.style.display = "none";
      });
    }

    window.addEventListener("click", (e) => {
      if (e.target === registerModal) {
        registerModal.style.display = "none";
        registerModal.setAttribute("aria-hidden", "true");
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = Object.fromEntries(new FormData(registerForm).entries());

      if (registerError) registerError.style.display = "none";
      if (registerSuccess) registerSuccess.style.display = "none";

      try {
        const res = await fetch("/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });
        const data = await res.json();

        if (data.success) {
          if (registerError) registerError.style.display = "none";
          if (registerSuccess) {
            registerSuccess.textContent = "Регистрация завершена. Теперь вы можете открыть личный кабинет.";
            registerSuccess.style.display = "block";
          } else {
            alert("Регистрация завершена");
          }
          registerForm.reset();
        } else {
          if (registerError) {
            registerError.textContent = data.message || "Ошибка регистрации";
            registerError.style.display = "block";
          } else {
            alert(data.message || "Ошибка регистрации");
          }
        }
      } catch (err) {
        if (registerError) {
          registerError.textContent = "Сеть недоступна или сервер не отвечает";
          registerError.style.display = "block";
        } else {
          alert("Сеть недоступна или сервер не отвечает");
        }
      }
    });
  }

  // FIX: Модальное окно описания товара
  const descriptionModal = document.getElementById('descriptionModal');
  const descriptionModalTitle = document.getElementById('descriptionModalTitle');
  const descriptionModalContent = document.getElementById('descriptionModalContent');
  const closeDescriptionBtn = document.querySelector('[data-close-description]');

  // Функция открытия модального окна описания
  function openDescriptionModal(productName, description) {
    if (!descriptionModal || !description) return;
    
    if (descriptionModalTitle) {
      descriptionModalTitle.textContent = productName || 'Описание товара';
    }
    
    if (descriptionModalContent) {
      // Экранируем HTML и создаем параграф
      const p = document.createElement('p');
      p.style.whiteSpace = 'pre-wrap';
      p.style.wordWrap = 'break-word';
      p.textContent = description;
      descriptionModalContent.innerHTML = '';
      descriptionModalContent.appendChild(p);
    }
    
    descriptionModal.style.display = 'block';
    descriptionModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // Функция закрытия модального окна описания
  function closeDescriptionModal() {
    if (!descriptionModal) return;
    descriptionModal.style.display = 'none';
    descriptionModal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Обработчик клика на значок "i" или кнопку "Описание"
  document.addEventListener('click', (e) => {
    // Клик на значок "i"
    const infoIcon = e.target.closest('.product-info-icon');
    if (infoIcon) {
      e.preventDefault();
      e.stopPropagation();
      const productName = infoIcon.getAttribute('data-product-name') || 'Товар';
      const description = infoIcon.getAttribute('data-description') || '';
      openDescriptionModal(productName, description);
      return;
    }

    // Клик на кнопку "Описание" (для совместимости)
    const descBtn = e.target.closest('[data-description-modal]');
    if (descBtn) {
      e.preventDefault();
      e.stopPropagation();
      const productName = descBtn.getAttribute('data-product-name') || 'Товар';
      const description = descBtn.getAttribute('data-description') || '';
      openDescriptionModal(productName, description);
      return;
    }

    // Закрытие модального окна описания
    if (e.target.closest('[data-close-description]')) {
      e.preventDefault();
      e.stopPropagation();
      closeDescriptionModal();
      return;
    }

    // Закрытие по клику на фон
    if (e.target === descriptionModal) {
      closeDescriptionModal();
      return;
    }
  });

  // Обработчик закрытия по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && descriptionModal && descriptionModal.style.display === 'block') {
      closeDescriptionModal();
    }
  });

  // ====== Категории и рейтинг ======
  document.addEventListener("click", async (e) => {
    // FIX: Пропускаем обработку, если клик по кнопке видео, изображениям или описанию (уже обработано выше)
    if (e.target.closest('.btn[data-video]') || 
        e.target.closest('[data-close-video]') || 
        e.target === videoOverlay ||
        e.target.closest('.product-image-slide') ||
        e.target.closest('.slider-arrow') ||
        e.target.closest('.slider-indicator') ||
        e.target.closest('[data-close-image]') ||
        e.target.closest('[data-image-nav]') ||
        e.target === imageOverlay ||
        e.target.closest('.product-info-icon') ||
        e.target.closest('[data-description-modal]') ||
        e.target.closest('[data-close-description]') ||
        e.target === descriptionModal) {
      return;
    }

    // Категории (открытие/закрытие/выбор)
    const openCat = e.target.closest("#openCategories");
    const dropdown = document.getElementById("categoriesMenu");

    if (openCat && dropdown) {
      const opened = dropdown.classList.toggle("open");
      dropdown.setAttribute("aria-hidden", opened ? "false" : "true");
      return;
    }

    const catItem = e.target.closest(".dropdown-item");
    if (catItem && dropdown) {
      const cat = catItem.getAttribute("data-category");
      const url = new URL(window.location.href);
      if (cat === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", cat);
      window.location.href = url.toString();
      return;
    }

    if (openServicesCat && servicesDropdown) {
      const opened = servicesDropdown.classList.toggle("open");
      servicesDropdown.setAttribute("aria-hidden", opened ? "false" : "true");
      return;
    }

    const servicesCatItem = e.target.closest(".dropdown-item");
    if (servicesCatItem && servicesDropdown && e.target.closest("#openServicesCategories, #servicesCategoriesMenu")) {
      const cat = servicesCatItem.getAttribute("data-category");
      const url = new URL(window.location.href);
      if (cat === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", cat);
      // Добавляем якорь для перехода к секции услуг
      url.hash = "services";
      window.location.href = url.toString();
      return;
    }

    if (dropdown && !e.target.closest(".category-dropdown")) {
      dropdown.classList.remove("open");
      dropdown.setAttribute("aria-hidden", "true");
    }

    if (servicesDropdown && !e.target.closest(".category-dropdown")) {
      servicesDropdown.classList.remove("open");
      servicesDropdown.setAttribute("aria-hidden", "true");
    }

    // Рейтинг (лайк/дизлайк) - доступно всем: гостям и пользователям
    const likeBtn = e.target.closest(".like-btn");
    const dislikeBtn = e.target.closest(".dislike-btn");

    if (likeBtn || dislikeBtn) {
      const ratingBlock = e.target.closest(".product-rating");
      if (!ratingBlock) return;
      
      const productId = ratingBlock.dataset.id;
      
      // Проверяем, голосовал ли уже (через cookie для гостей или data-атрибут для пользователей)
      if (ratingBlock.dataset.voted === "true") {
        return;
      }
      
      // Для гостей также проверяем cookie
      if (!window.IS_AUTH) {
        const voteCookie = document.cookie.split(';').some(cookie => cookie.trim().startsWith(`exto_vote_${productId}=`));
        if (voteCookie) {
          ratingBlock.dataset.voted = "true";
          ratingBlock.querySelectorAll("button").forEach((b) => {
            b.disabled = true;
          });
          return;
        }
      }

      const resultEl = ratingBlock.querySelector(".result");
      const votesEl = ratingBlock.querySelector(".votes");
      const productId = ratingBlock.dataset.id;
      const value = likeBtn ? "like" : "dislike";

      // Отключаем кнопки сразу, чтобы предотвратить повторные клики
      ratingBlock.querySelectorAll("button").forEach((b) => {
        b.disabled = true;
      });

      try {
        const res = await fetch(`/api/rating/${productId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value }),
          credentials: 'include' // Важно для отправки cookie
        });
        const data = await res.json();

        if (data.success) {
          if (resultEl) resultEl.textContent = String(data.result);
          if (votesEl) votesEl.textContent = `(${data.total} голосов)`;
          ratingBlock.dataset.voted = "true";
        } else {
          console.warn("⚠️ Сервер вернул ошибку:", data.message || data.error);
          // Включаем кнопки обратно при ошибке
          ratingBlock.querySelectorAll("button").forEach((b) => {
            b.disabled = false;
          });
          
          if (res.status === 409) {
            // Уже голосовал - помечаем как проголосовавший
            ratingBlock.dataset.voted = "true";
            ratingBlock.querySelectorAll("button").forEach((b) => {
              b.disabled = true;
            });
          } else {
            alert(data.message || "Ошибка при голосовании");
          }
        }
      } catch (err) {
        console.error("❌ Ошибка сохранения рейтинга:", err);
        // Включаем кнопки обратно при ошибке
        ratingBlock.querySelectorAll("button").forEach((b) => {
          b.disabled = false;
        });
      }
    }
  });
});
