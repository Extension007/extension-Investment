// =======================
// Глобальные переменные
// =======================
let player = null;
let currentVideoId = null;
let playerReady = false; // флаг готовности плеера

// =======================
// Вспомогательные функции
// =======================

// Извлечение videoId из разных форматов ссылок YouTube
function extractVideoId(url) {
  if (!url) return null;
  if (url.includes('/embed/')) return url.split('/embed/')[1].split(/[?#]/)[0];
  if (url.includes('/shorts/')) return url.split('/shorts/')[1].split(/[?#]/)[0];
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?#]/)[0];
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

// =======================
// YouTube IFrame API
// =======================

// Инициализация YouTube IFrame API — создаём плеер в контейнере videoFrame
window.onYouTubeIframeAPIReady = function () {
  try {
    player = new YT.Player('videoFrame', {
      width: '100%',
      height: '100%',
      videoId: '',
      playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
      events: {
        'onReady': function (event) {
          playerReady = true;
          console.log('✅ Плеер готов');

          // Если до инициализации уже был выбран videoId — загрузим его с небольшой задержкой
          if (currentVideoId) {
            // даём браузеру один кадр на рендер модалки
            setTimeout(() => {
              try {
                player.loadVideoById(currentVideoId);
                console.log('🎬 Автозапуск после готовности:', currentVideoId);
              } catch (err) {
                console.warn('⚠️ Не удалось автозагрузить видео после готовности плеера:', err);
              }
            }, 160);
          }
        },
        'onError': function (e) {
          console.error('❌ Ошибка плеера:', e && e.data ? e.data : e);
        }
      }
    });
    console.log('✅ YouTube Player создан');
  } catch (err) {
    console.error('❌ Ошибка при создании YouTube Player:', err);
  }
};

// =======================
// Обработчики модалки видео (универсальные, iOS-friendly)
// =======================

document.addEventListener('click', (e) => {
  // Открытие по кнопке data-video
  const openBtn = e.target.closest('.btn[data-video]');
  if (openBtn) {
    const url = openBtn.getAttribute('data-video');
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.error('❌ Не удалось извлечь videoId из URL:', url);
      return;
    }

    currentVideoId = videoId;
    const modal = document.getElementById('videoModal');
    if (!modal) {
      console.error('❌ Модалка videoModal не найдена');
      return;
    }

    // Показываем модалку без использования display:none
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    // iOS Safari требует небольшой задержки перед инициализацией/загрузкой видео
    setTimeout(() => {
      if (player && typeof player.loadVideoById === 'function' && playerReady) {
        try {
          player.loadVideoById(currentVideoId);
          console.log('✅ Видео загружено:', currentVideoId);
        } catch (err) {
          console.error('❌ Ошибка при loadVideoById:', err);
          // Фоллбэк: откроем ссылку в новой вкладке
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } else {
        console.warn('⚠️ Плеер ещё не готов — видео будет загружено при onReady');
        // плеер загрузит видео при onReady (см. onReady выше)
      }
    }, 160);

    return;
  }

  // Закрытие по кнопке [data-close-video] или по клику вне контента
  if (e.target.closest('[data-close-video]') || (e.target.id === 'videoModal')) {
    const modal = document.getElementById('videoModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');

    // Остановим видео
    if (player && typeof player.stopVideo === 'function') {
      try {
        player.stopVideo();
        console.log('✅ Видео остановлено');
      } catch (err) {
        console.warn('⚠️ Ошибка при остановке видео:', err);
      }
    }
    currentVideoId = null;
    return;
  }
});

// =======================
// DOMContentLoaded: регистрация, категории, рейтинг (сохраняем твою логику)
// =======================
document.addEventListener("DOMContentLoaded", () => {
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
    // Если клик по кнопке видео — уже обработано выше
    const videoBtn = e.target.closest("[data-video]");
    if (videoBtn) return;

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
