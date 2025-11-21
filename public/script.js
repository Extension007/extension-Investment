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
  // FIX: Полноэкранный overlay для YouTube видео
  const videoOverlay = document.getElementById('videoOverlay');
  const videoIframeContainer = document.getElementById('videoIframeContainer');
  let currentVideoIframe = null;
  let currentVideoUrl = null;

  // FIX: Overlay для просмотра изображений
  const imageOverlay = document.getElementById('imageOverlay');
  const imageOverlayImg = document.getElementById('imageOverlayImg');
  let currentImageIndex = 0;
  let currentImages = [];
  let currentProductId = null;
  
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
  
  // FIX: Функция открытия overlay с изображением
  function openImageOverlay(imageSrc, imageIndex, images, productId) {
    currentImages = images;
    currentImageIndex = imageIndex;
    currentProductId = productId;
    imageOverlayImg.src = imageSrc;
    imageOverlayImg.alt = `Изображение ${imageIndex + 1} из ${images.length}`;
    imageOverlay.classList.add('show');
    imageOverlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  // FIX: Функция закрытия overlay с изображением
  function closeImageOverlay() {
    imageOverlay.classList.remove('show');
    imageOverlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentImages = [];
    currentImageIndex = 0;
    currentProductId = null;
  }

  // FIX: Функция переключения изображения в overlay
  function navigateImage(direction) {
    if (currentImages.length === 0) return;
    if (direction === 'next') {
      currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    } else if (direction === 'prev') {
      currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    }
    imageOverlayImg.src = currentImages[currentImageIndex];
    imageOverlayImg.alt = `Изображение ${currentImageIndex + 1} из ${currentImages.length}`;
  }

  // FIX: Инициализация tooltip и блока описания
  function initTooltipsAndDescription() {
    const infoIcons = document.querySelectorAll('.product-info-icon');
    infoIcons.forEach(icon => {
      const description = icon.getAttribute('data-description');
      if (!description) return;

      const productCard = icon.closest('.product-card');
      const productId = productCard ? productCard.getAttribute('data-product-id') : null;
      const descriptionBlock = productId ? document.querySelector(`.product-description-block[data-product-id="${productId}"]`) : null;

      // FIX: Создаем tooltip элемент
      const tooltip = document.createElement('div');
      tooltip.className = 'product-info-tooltip';
      tooltip.textContent = description;
      icon.appendChild(tooltip);

      let tooltipTimeout = null;
      let isTooltipVisible = false;

      // FIX: Показываем tooltip при наведении (desktop) с задержкой
      icon.addEventListener('mouseenter', () => {
        if (tooltipTimeout) clearTimeout(tooltipTimeout);
        tooltipTimeout = setTimeout(() => {
          tooltip.classList.add('show');
          isTooltipVisible = true;
        }, 150);
      });

      // FIX: Скрываем tooltip при уходе курсора
      icon.addEventListener('mouseleave', () => {
        if (tooltipTimeout) clearTimeout(tooltipTimeout);
        tooltip.classList.remove('show');
        isTooltipVisible = false;
      });

      // FIX: Поддержка touch-событий для мобильных (tap для показа/скрытия)
      let touchStartTime = 0;
      icon.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();
        e.preventDefault();
      }, { passive: false });

      icon.addEventListener('touchend', (e) => {
        const touchDuration = Date.now() - touchStartTime;
        if (touchDuration < 300) {
          // Короткое касание - переключаем tooltip
          e.preventDefault();
          if (isTooltipVisible) {
            tooltip.classList.remove('show');
            isTooltipVisible = false;
          } else {
            tooltip.classList.add('show');
            isTooltipVisible = true;
          }
        }
      }, { passive: false });

      // FIX: Показываем/скрываем блок описания по клику на иконку
      if (descriptionBlock) {
        icon.addEventListener('click', (e) => {
          e.stopPropagation();
          const isVisible = descriptionBlock.style.display !== 'none';
          if (isVisible) {
            descriptionBlock.style.display = 'none';
          } else {
            descriptionBlock.style.display = 'block';
          }
        });
      }
    });
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

      // FIX: Обработчик клика на изображение для открытия в overlay
      images.forEach((img, idx) => {
        img.addEventListener('click', () => {
          const allImages = Array.from(images).map(i => i.getAttribute('data-image-src'));
          const productId = slider.getAttribute('data-product-id');
          openImageOverlay(img.getAttribute('data-image-src'), idx, allImages, productId);
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

  // FIX: Инициализация всех компонентов
  initTooltipsAndDescription();
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

  // ====== Категории и рейтинг ======
  document.addEventListener("click", async (e) => {
    // FIX: Пропускаем обработку, если клик по кнопке видео или изображениям (уже обработано выше)
    if (e.target.closest('.btn[data-video]') || 
        e.target.closest('[data-close-video]') || 
        e.target === videoOverlay ||
        e.target.closest('.product-image-slide') ||
        e.target.closest('.slider-arrow') ||
        e.target.closest('.slider-indicator') ||
        e.target.closest('[data-close-image]') ||
        e.target.closest('[data-image-nav]') ||
        e.target === imageOverlay ||
        e.target.closest('.product-info-icon')) {
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

    if (dropdown && !e.target.closest(".category-dropdown")) {
      dropdown.classList.remove("open");
      dropdown.setAttribute("aria-hidden", "true");
    }

    // Рейтинг (лайк/дизлайк)
    const likeBtn = e.target.closest(".like-btn");
    const dislikeBtn = e.target.closest(".dislike-btn");

    if (likeBtn || dislikeBtn) {
      if (!window.IS_AUTH) {
        const modal = document.getElementById("registerModal");
        if (modal) {
          modal.style.display = "block";
          modal.setAttribute("aria-hidden", "false");
        } else {
          alert("Голосование доступно только зарегистрированным пользователям");
        }
        return;
      }

      const ratingBlock = e.target.closest(".product-rating");
      if (!ratingBlock) return;
      if (ratingBlock.dataset.voted === "true") return;

      const resultEl = ratingBlock.querySelector(".result");
      const votesEl = ratingBlock.querySelector(".votes");
      const productId = ratingBlock.dataset.id;
      const value = likeBtn ? "like" : "dislike";

      try {
        const res = await fetch(`/api/rating/${productId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value })
        });
        const data = await res.json();

        if (data.success) {
          if (resultEl) resultEl.textContent = String(data.result);
          if (votesEl) votesEl.textContent = `(${data.total} голосов)`;
          ratingBlock.dataset.voted = "true";
          ratingBlock.querySelectorAll("button").forEach((b) => {
            b.disabled = true;
          });
        } else {
          console.warn("⚠️ Сервер вернул ошибку:", data.message || data.error);
          if (res.status === 401) {
            alert("Голосование доступно только зарегистрированным пользователям");
          }
          if (res.status === 409) {
            ratingBlock.dataset.voted = "true";
            ratingBlock.querySelectorAll("button").forEach((b) => {
              b.disabled = true;
            });
          }
        }
      } catch (err) {
        console.error("❌ Ошибка сохранения рейтинга:", err);
      }
    }
  });
});
