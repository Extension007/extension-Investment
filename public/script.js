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

// FIX: Инициализация YouTube IFrame API с поддержкой iOS Safari
window.onYouTubeIframeAPIReady = function () {
  try {
    player = new YT.Player('videoFrame', {
      width: '100%',
      height: '100%',
      videoId: '',
      // FIX: Добавлены параметры для iOS Safari: enablejsapi=1, playsinline=1
      playerVars: { 
        rel: 0, 
        playsinline: 1, 
        modestbranding: 1,
        enablejsapi: 1, // FIX: Обязательно для iOS Safari
        origin: window.location.origin // FIX: Для безопасности и совместимости
      },
      events: {
        'onReady': function (event) {
          playerReady = true;
          console.log('✅ Плеер готов');

          // FIX: Если до инициализации уже был выбран videoId — загрузим его с небольшой задержкой
          if (currentVideoId) {
            // даём браузеру один кадр на рендер модалки
            setTimeout(() => {
              try {
                player.loadVideoById(currentVideoId);
                // FIX: На iOS Safari требуется явный вызов playVideo() после загрузки
                setTimeout(() => {
                  if (player && typeof player.playVideo === 'function') {
                    player.playVideo();
                  }
                }, 200);
                console.log('🎬 Автозапуск после готовности:', currentVideoId);
              } catch (err) {
                console.warn('⚠️ Не удалось автозагрузить видео после готовности плеера:', err);
              }
            }, 160);
          }
        },
        'onError': function (e) {
          console.error('❌ Ошибка плеера:', e && e.data ? e.data : e);
        },
        // FIX: Обработчик состояния плеера для отладки
        'onStateChange': function (event) {
          const states = {
            0: 'ENDED',
            1: 'PLAYING',
            2: 'PAUSED',
            3: 'BUFFERING',
            5: 'CUED'
          };
          console.log('📹 Состояние плеера:', states[event.data] || event.data);
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
  // FIX: Открытие по кнопке data-video с поддержкой iOS Safari
  const openBtn = e.target.closest('.btn[data-video]');
  if (openBtn) {
    const url = openBtn.getAttribute('data-video');
    const videoId = extractVideoId(url);
    if (!videoId) {
      console.error('❌ Не удалось извлечь videoId из URL:', url);
      return;
    }

    // FIX: Логирование открытия видео
    console.log('🎬 Открытие видео:', videoId, 'URL:', url);

    currentVideoId = videoId;
    const modal = document.getElementById('videoModal');
    if (!modal) {
      console.error('❌ Модалка videoModal не найдена');
      return;
    }

    // FIX: Показываем модалку без использования display:none (важно для iOS Safari)
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');

    // FIX: iOS Safari требует задержки и явного вызова playVideo()
    setTimeout(() => {
      if (player && typeof player.loadVideoById === 'function' && playerReady) {
        try {
          player.loadVideoById(currentVideoId);
          console.log('✅ Видео загружено:', currentVideoId);
          
          // FIX: На iOS Safari требуется явный вызов playVideo() после загрузки
          setTimeout(() => {
            if (player && typeof player.playVideo === 'function') {
              try {
                player.playVideo();
                console.log('▶️ Запуск воспроизведения (iOS Safari)');
              } catch (playErr) {
                console.warn('⚠️ Не удалось запустить воспроизведение:', playErr);
                // FIX: Fallback - открываем в новой вкладке, если не удалось запустить
                console.log('🔄 Fallback: открытие видео в новой вкладке');
                window.open(url, '_blank', 'noopener,noreferrer');
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
              }
            }
          }, 300);
        } catch (err) {
          console.error('❌ Ошибка при loadVideoById:', err);
          // FIX: Fallback - откроем ссылку в новой вкладке
          console.log('🔄 Fallback: открытие видео в новой вкладке из-за ошибки загрузки');
          window.open(url, '_blank', 'noopener,noreferrer');
          modal.classList.remove('show');
          modal.setAttribute('aria-hidden', 'true');
        }
      } else {
        console.warn('⚠️ Плеер ещё не готов — видео будет загружено при onReady');
        // FIX: Если плеер не готов долго, используем fallback
        const fallbackTimeout = setTimeout(() => {
          if (!playerReady) {
            console.log('🔄 Fallback: плеер не готов, открытие видео в новой вкладке');
            window.open(url, '_blank', 'noopener,noreferrer');
            modal.classList.remove('show');
            modal.setAttribute('aria-hidden', 'true');
          }
        }, 3000);
        
        // FIX: Очищаем таймаут, если плеер готовится
        const checkReady = setInterval(() => {
          if (playerReady) {
            clearInterval(checkReady);
            clearTimeout(fallbackTimeout);
            if (player && typeof player.loadVideoById === 'function') {
              try {
                player.loadVideoById(currentVideoId);
                setTimeout(() => {
                  if (player && typeof player.playVideo === 'function') {
                    player.playVideo();
                  }
                }, 300);
              } catch (err) {
                console.error('❌ Ошибка при загрузке видео после готовности:', err);
                window.open(url, '_blank', 'noopener,noreferrer');
                modal.classList.remove('show');
                modal.setAttribute('aria-hidden', 'true');
              }
            }
          }
        }, 100);
      }
    }, 160);

    return;
  }

  // FIX: Закрытие по кнопке [data-close-video] или по клику вне контента
  if (e.target.closest('[data-close-video]') || (e.target.id === 'videoModal')) {
    const modal = document.getElementById('videoModal');
    if (!modal) return;
    
    // FIX: Логирование закрытия видео
    console.log('🔒 Закрытие видео:', currentVideoId || 'неизвестно');
    
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');

    // FIX: Остановим видео при закрытии
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
