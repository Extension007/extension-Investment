// =======================
// Глобальные переменные
// =======================
// FIX: Добавлены переменные для отслеживания состояния плеера и таймаута fallback
let player = null;
let currentVideoId = null;
let playerReady = false; // флаг готовности плеера
let fallbackTimeout = null; // таймаут для fallback на открытие в новой вкладке
let isVideoModalOpen = false; // флаг открытия модалки видео

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

// FIX: Инициализация YouTube IFrame API с параметрами для iOS Safari
// Инициализация YouTube IFrame API — создаём плеер в контейнере videoFrame
window.onYouTubeIframeAPIReady = function () {
  try {
    player = new YT.Player('videoFrame', {
      width: '100%',
      height: '100%',
      videoId: '',
      // FIX: Добавлены параметры для iOS Safari: enablejsapi=1, playsinline=1
      playerVars: { 
        rel: 0, 
        playsinline: 1, // FIX: Воспроизведение inline на iOS
        modestbranding: 1,
        enablejsapi: 1, // FIX: Включение JavaScript API для управления плеером
        autoplay: 0, // FIX: Автозапуск отключен, запуск только по клику пользователя
        controls: 1,
        fs: 1,
        iv_load_policy: 3
      },
      events: {
        'onReady': function (event) {
          playerReady = true;
          console.log('✅ Плеер готов');

          // FIX: Если до инициализации уже был выбран videoId — загрузим его с небольшой задержкой
          // Если до инициализации уже был выбран videoId — загрузим его с небольшой задержкой
          if (currentVideoId && isVideoModalOpen) {
            // даём браузеру один кадр на рендер модалки
            setTimeout(() => {
              try {
                // FIX: Запуск видео только после готовности плеера (iOS Safari)
                player.loadVideoById(currentVideoId);
                // FIX: Пытаемся запустить воспроизведение после загрузки
                setTimeout(() => {
                  try {
                    if (player && typeof player.playVideo === 'function') {
                      player.playVideo();
                      console.log('🎬 Видео запущено после готовности плеера:', currentVideoId);
                    }
                  } catch (err) {
                    console.warn('⚠️ Не удалось запустить видео после загрузки:', err);
                  }
                }, 300);
                console.log('🎬 Автозапуск после готовности:', currentVideoId);
              } catch (err) {
                console.warn('⚠️ Не удалось автозагрузить видео после готовности плеера:', err);
              }
            }, 160);
          }
        },
        'onError': function (e) {
          console.error('❌ Ошибка плеера:', e && e.data ? e.data : e);
          // FIX: При ошибке плеера открываем видео в новой вкладке
          if (currentVideoId && isVideoModalOpen) {
            const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
            console.log('⚠️ Открытие видео в новой вкладке из-за ошибки плеера');
            window.open(videoUrl, '_blank', 'noopener,noreferrer');
          }
        },
        // FIX: Обработчик состояния плеера для отслеживания воспроизведения
        'onStateChange': function (event) {
          if (event.data === YT.PlayerState.PLAYING) {
            console.log('▶️ Видео начало воспроизведение');
            // FIX: Отменяем fallback, если видео успешно запустилось
            if (fallbackTimeout) {
              clearTimeout(fallbackTimeout);
              fallbackTimeout = null;
            }
          } else if (event.data === YT.PlayerState.ENDED) {
            console.log('⏹️ Видео завершено');
          }
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

// FIX: Обработчик кликов для открытия и закрытия видео с поддержкой iOS Safari
document.addEventListener('click', (e) => {
  // FIX: Открытие видео по клику на кнопку "Обзор" (только по действию пользователя)
  // Открытие по кнопке data-video
  const openBtn = e.target.closest('.btn[data-video]');
  if (openBtn) {
    const url = openBtn.getAttribute('data-video');
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.error('❌ Не удалось извлечь videoId из URL:', url);
      return;
    }

    // FIX: Логирование открытия видео
    console.log('🎬 Открытие видео:', videoId);
    isVideoModalOpen = true;
    currentVideoId = videoId;
    const modal = document.getElementById('videoModal');
    if (!modal) {
      console.error('❌ Модалка videoModal не найдена');
      return;
    }

    // FIX: Отменяем предыдущий fallback таймаут, если он был
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
      fallbackTimeout = null;
    }

    // Показываем модалку без использования display:none
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    // FIX: iOS Safari требует задержки и проверки готовности плеера
    // iOS Safari требует небольшой задержки перед инициализацией/загрузкой видео
    setTimeout(() => {
      if (player && typeof player.loadVideoById === 'function' && playerReady) {
        try {
          // FIX: Загружаем видео по ID
          player.loadVideoById(currentVideoId);
          console.log('✅ Видео загружено в плеер:', currentVideoId);
          
          // FIX: Пытаемся запустить воспроизведение после загрузки (iOS Safari)
          setTimeout(() => {
            try {
              if (player && typeof player.playVideo === 'function') {
                player.playVideo();
                console.log('▶️ Попытка запуска воспроизведения видео');
              }
            } catch (err) {
              console.warn('⚠️ Не удалось запустить видео:', err);
            }
          }, 300);

          // FIX: Устанавливаем fallback таймаут на случай, если видео не запустится
          fallbackTimeout = setTimeout(() => {
            // Проверяем, запустилось ли видео (если плеер доступен)
            try {
              if (player && typeof player.getPlayerState === 'function') {
                const state = player.getPlayerState();
                // YT.PlayerState.PLAYING = 1
                if (state !== 1 && isVideoModalOpen) {
                  console.warn('⚠️ Видео не запустилось, открываем в новой вкладке');
                  const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
                  window.open(videoUrl, '_blank', 'noopener,noreferrer');
                }
              }
            } catch (err) {
              console.warn('⚠️ Не удалось проверить состояние плеера, открываем в новой вкладке');
              const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
              window.open(videoUrl, '_blank', 'noopener,noreferrer');
            }
          }, 2000); // FIX: 2 секунды на запуск видео
        } catch (err) {
          console.error('❌ Ошибка при loadVideoById:', err);
          // FIX: Фоллбэк: откроем ссылку в новой вкладке при ошибке
          const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
          window.open(videoUrl, '_blank', 'noopener,noreferrer');
        }
      } else {
        console.warn('⚠️ Плеер ещё не готов — видео будет загружено при onReady');
        // FIX: Устанавливаем fallback таймаут на случай, если плеер не готов
        fallbackTimeout = setTimeout(() => {
          if (!playerReady && isVideoModalOpen) {
            console.warn('⚠️ Плеер не готов, открываем видео в новой вкладке');
            const videoUrl = `https://www.youtube.com/watch?v=${currentVideoId}`;
            window.open(videoUrl, '_blank', 'noopener,noreferrer');
          }
        }, 3000); // FIX: 3 секунды на инициализацию плеера
        // плеер загрузит видео при onReady (см. onReady выше)
      }
    }, 160);

    return;
  }

  // FIX: Закрытие видео с логированием и очисткой состояния
  // Закрытие по кнопке [data-close-video] или по клику вне контента
  if (e.target.closest('[data-close-video]') || (e.target.id === 'videoModal')) {
    const modal = document.getElementById('videoModal');
    if (!modal) return;

    // FIX: Логирование закрытия видео
    console.log('🔒 Закрытие видео');
    isVideoModalOpen = false;

    // FIX: Отменяем fallback таймаут при закрытии
    if (fallbackTimeout) {
      clearTimeout(fallbackTimeout);
      fallbackTimeout = null;
    }

    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');

    // FIX: Останавливаем видео при закрытии модалки
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
