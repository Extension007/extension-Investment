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

// FIX: Формирование URL для YouTube embed с параметрами для iOS Safari
function buildYouTubeEmbedUrl(videoId) {
  if (!videoId) return '';
  // FIX: playsinline=1 и autoplay=1 обязательны для iOS Safari
  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
}

// =======================
// Обработчики видео overlay, регистрация, категории, рейтинг
// =======================

document.addEventListener("DOMContentLoaded", () => {
  // FIX: Полноэкранный overlay для YouTube видео
  const videoOverlay = document.getElementById('videoOverlay');
  const videoIframeContainer = document.getElementById('videoIframeContainer');
  const closeVideoBtn = document.querySelector('[data-close-video]');
  
  // FIX: Функция открытия видео overlay
  function openVideoOverlay(videoUrl) {
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      console.warn('⚠️ Не удалось извлечь videoId из URL:', videoUrl);
      return;
    }
    
    // FIX: Создаем iframe динамически по клику (важно для iOS Safari)
    const iframe = document.createElement('iframe');
    iframe.src = buildYouTubeEmbedUrl(videoId);
    // FIX: allowfullscreen включен в allow, отдельный атрибут не нужен
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.setAttribute('playsinline', '1');
    iframe.setAttribute('frameborder', '0');
    
    // FIX: Очищаем контейнер перед добавлением нового iframe
    videoIframeContainer.innerHTML = '';
    videoIframeContainer.appendChild(iframe);
    
    // FIX: Показываем overlay
    videoOverlay.style.display = 'flex';
    videoOverlay.setAttribute('aria-hidden', 'false');
    
    console.log('▶️ Открытие видео:', videoId);
  }
  
  // FIX: Функция закрытия видео overlay
  function closeVideoOverlay() {
    // FIX: Очищаем src у iframe для остановки воспроизведения
    const iframe = videoIframeContainer.querySelector('iframe');
    if (iframe) {
      iframe.src = '';
    }
    
    // FIX: Очищаем контейнер
    videoIframeContainer.innerHTML = '';
    
    // FIX: Скрываем overlay
    videoOverlay.style.display = 'none';
    videoOverlay.setAttribute('aria-hidden', 'true');
    
    console.log('🔒 Закрытие видео overlay');
  }
  
  // FIX: Обработчик клика на кнопку "Обзор" и закрытия overlay
  document.addEventListener('click', (e) => {
    // FIX: Открытие видео по клику на кнопку "Обзор"
    const videoBtn = e.target.closest('.btn[data-video]');
    if (videoBtn) {
      e.preventDefault();
      e.stopPropagation();
      const videoUrl = videoBtn.getAttribute('data-video');
      openVideoOverlay(videoUrl);
      return;
    }
    
    // FIX: Закрытие overlay по кнопке закрытия
    if (e.target.closest('[data-close-video]')) {
      e.preventDefault();
      e.stopPropagation();
      closeVideoOverlay();
      return;
    }
    
    // FIX: Закрытие overlay по клику на фон (но не на контейнер с видео)
    if (e.target === videoOverlay) {
      closeVideoOverlay();
      return;
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
      // регистрационная модалка может оставаться через display (не влияет на видео)
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
    // FIX: Пропускаем обработку, если клик по кнопке видео (уже обработано выше)
    if (e.target.closest('.btn[data-video]') || e.target.closest('[data-close-video]') || e.target === videoOverlay) {
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
          // обновляем результат (лайки − дизлайки)
          if (resultEl) resultEl.textContent = String(data.result);
          // обновляем количество голосов
          if (votesEl) votesEl.textContent = `(${data.total} голосов)`;
          // помечаем, что голос отдан и блокируем повтор
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
