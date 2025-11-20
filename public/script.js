// 🔹 YouTube IFrame Player API - глобальные переменные и функции
let player = null;
let currentVideoId = null;

// Глобальная функция, вызываемая YouTube API при загрузке
// ДОЛЖНА быть определена ДО загрузки YouTube API скрипта
window.onYouTubeIframeAPIReady = function() {
  console.log("✅ YouTube IFrame API готов");
  // Плеер будет создан при открытии модального окна
};

document.addEventListener("DOMContentLoaded", () => {
  // 🔹 Модалка регистрации
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
    closeRegisterBtn?.addEventListener("click", () => {
      registerModal.style.display = "none";
      registerModal.setAttribute("aria-hidden", "true");
      registerError && (registerError.style.display = "none");
    });
    window.addEventListener("click", (e) => { if (e.target === registerModal) { registerModal.style.display = "none"; registerModal.setAttribute("aria-hidden", "true"); } });
  }

  registerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(registerForm).entries());
    
    // Скрываем предыдущие сообщения
    if (registerError) { registerError.style.display = "none"; }
    if (registerSuccess) { registerSuccess.style.display = "none"; }
    
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (data.success) {
        // Показываем сообщение об успешной регистрации без редиректа
        if (registerError) { registerError.style.display = "none"; }
        if (registerSuccess) {
          registerSuccess.textContent = "Регистрация завершена. Теперь вы можете открыть личный кабинет.";
          registerSuccess.style.display = "block";
        } else {
          alert("Регистрация завершена");
        }
        // Очищаем форму
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

  // 🔹 Функция извлечения videoId из YouTube URL
  function extractVideoId(url) {
    try {
      if (!url || typeof url !== 'string') return null;
      
      url = url.trim();
      
      // Если уже embed URL, извлекаем video ID
      if (url.includes('/embed/')) {
        const embedId = url.match(/embed\/([^?&#]+)/)?.[1];
        if (embedId) {
          return embedId.split('&')[0].split('#')[0].trim();
        }
      }
      
      const u = new URL(url);
      const host = u.hostname.replace(/^www\./, "").toLowerCase();
      let videoId = null;
      
      if (host.includes("youtube.com")) {
        if (u.pathname === "/watch") {
          videoId = u.searchParams.get("v");
        } else if (u.pathname.startsWith("/embed/")) {
          videoId = u.pathname.split("/embed/")[1]?.split("?")[0];
        } else if (u.pathname.startsWith("/shorts/")) {
          videoId = u.pathname.split("/shorts/")[1]?.split("?")[0];
        } else if (u.pathname.startsWith("/v/")) {
          videoId = u.pathname.split("/v/")[1]?.split("?")[0];
        }
      } else if (host === "youtu.be") {
        videoId = u.pathname.slice(1).split("?")[0];
      }
      
      if (videoId) {
        videoId = videoId.split('&')[0].split('#')[0].trim();
        return videoId || null;
      }
      
      return null;
    } catch (err) {
      console.error("Ошибка извлечения videoId:", err);
      return null;
    }
  }

  // 🔹 Модальное окно для видео
  const modal = document.getElementById("videoModal");
  const videoFrame = document.getElementById("videoFrame");
  const closeBtn = document.querySelector(".modal .close");

  if (modal && videoFrame) {
    // Функция для открытия видео
    function openVideoModal(videoUrl) {
      if (!videoUrl) {
        console.warn("Пустой URL видео");
        return;
      }
      
      console.log("🎬 Открытие видео:", videoUrl);
      
      // Извлекаем videoId из URL
      const videoId = extractVideoId(videoUrl);
      if (!videoId) {
        console.error("❌ Не удалось извлечь videoId из URL:", videoUrl);
        alert("Некорректная ссылка на видео. Поддерживаются только ссылки YouTube.");
        return;
      }

      console.log("✅ Video ID:", videoId);
      currentVideoId = videoId;

      // Останавливаем предыдущий плеер, если он существует
      if (player) {
        try {
          player.destroy();
          player = null;
        } catch (e) {
          console.warn("Ошибка при уничтожении предыдущего плеера:", e);
        }
      }

      // Очищаем контейнер
      videoFrame.innerHTML = "";

      // Открываем модальное окно
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");

      // Создаем новый плеер
      if (typeof YT !== 'undefined' && YT.Player) {
        // API уже загружен
        createPlayer(videoId);
      } else {
        // Ждем загрузки API
        const checkAPI = setInterval(() => {
          if (typeof YT !== 'undefined' && YT.Player) {
            clearInterval(checkAPI);
            createPlayer(videoId);
          }
        }, 100);
        
        // Таймаут на случай, если API не загрузится
        setTimeout(() => {
          clearInterval(checkAPI);
          if (typeof YT === 'undefined' || !YT.Player) {
            console.error("❌ YouTube IFrame API не загружен");
            alert("Ошибка загрузки YouTube API. Пожалуйста, обновите страницу.");
            closeModal();
          }
        }, 5000);
      }
      
      if (typeof trapFocus === "function") {
        trapFocus(modal);
      }
    }

    // Функция создания плеера
    function createPlayer(videoId) {
      try {
        player = new YT.Player('videoFrame', {
          videoId: videoId,
          width: '100%',
          height: '480',
          playerVars: {
            rel: 0,
            playsinline: 1,
            modestbranding: 1,
            controls: 1
          },
          events: {
            'onReady': onPlayerReady,
            'onError': onPlayerError
          }
        });
        console.log("✅ Плеер создан для videoId:", videoId);
      } catch (e) {
        console.error("❌ Ошибка создания плеера:", e);
        alert("Ошибка создания видеоплеера. Пожалуйста, попробуйте еще раз.");
        closeModal();
      }
    }

    // Обработчик готовности плеера
    function onPlayerReady(event) {
      console.log("✅ Плеер готов");
      // Видео не запускается автоматически - пользователь должен нажать play вручную
      // Это соответствует требованиям (без autoplay)
    }

    // Обработчик ошибок плеера
    function onPlayerError(event) {
      console.error("❌ Ошибка плеера:", event.data);
      let errorMsg = "Произошла ошибка при загрузке видео.";
      switch(event.data) {
        case 2: errorMsg = "Некорректный videoId."; break;
        case 5: errorMsg = "HTML5 плеер не может воспроизвести видео."; break;
        case 100: errorMsg = "Видео не найдено или недоступно."; break;
        case 101:
        case 150: errorMsg = "Владелец видео запретил встраивание на других сайтах."; break;
      }
      alert(errorMsg);
      closeModal();
    }

    // Обработчик клика на кнопки с data-video (используем делегирование с capture phase)
    // КРИТИЧНО: для iOS важно, чтобы openVideoModal вызывалась синхронно в обработчике клика
    document.addEventListener("click", (e) => {
      // Проверяем, кликнули ли на кнопку с data-video или внутри неё
      const btn = e.target.closest("[data-video]");
      if (!btn) return;
      
      console.log("🖱️ Клик по кнопке видео:", btn);
      
      // Предотвращаем всплытие события
      e.preventDefault();
      e.stopPropagation();

      const rawUrl = btn.getAttribute("data-video")?.trim();
      if (!rawUrl) {
        console.warn("⚠️ Кнопка с data-video не содержит URL");
        return;
      }

      console.log("📹 URL из атрибута:", rawUrl);
      // Вызываем синхронно - это важно для iOS (user gesture должен быть сохранен)
      openVideoModal(rawUrl);
    }, true); // Используем capture phase для приоритета

    // Обработчик закрытия модального окна
    const closeVideoBtn = document.querySelector("[data-close-video]");
    if (closeVideoBtn) {
      closeVideoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
    });
    } else if (closeBtn) {
      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }
    
    // Обработчик клика вне модального окна (только на overlay)
    window.addEventListener("click", (e) => { 
      // Проверяем, что клик именно на overlay (сам modal), а не на его содержимое
      if (e.target === modal && modal.style.display === "block") {
        closeModal();
      }
    });
    
    // Закрытие по Escape
    window.addEventListener("keydown", (e) => { 
      if (e.key === "Escape" && modal.style.display === "block") {
        closeModal();
      }
    });

    function closeModal() {
      // Останавливаем и уничтожаем плеер перед закрытием модалки
      if (player) {
        try {
          player.stopVideo();
          player.destroy();
          player = null;
        } catch (e) {
          console.warn("Ошибка при остановке плеера:", e);
        }
      }
      
      // Очищаем контейнер
      videoFrame.innerHTML = "";
      currentVideoId = null;
      
      // Закрываем модальное окно
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      
      if (typeof releaseFocus === "function") {
        releaseFocus();
      }
    }

    let previousActive = null;
    function trapFocus(container) {
      previousActive = document.activeElement;
      const focusables = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (first) first.focus();
      container.addEventListener("keydown", handleTab);
      function handleTab(e) {
        if (e.key !== "Tab") return;
        if (focusables.length === 0) return;
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    }

    function releaseFocus() {
      if (previousActive && typeof previousActive.focus === "function") previousActive.focus();
    }
  }

  // 🔹 Логика рейтинга (лайки/дизлайки → результат и общее количество голосов)
  document.addEventListener("click", async (e) => {
    // Сначала проверяем, не кликнули ли на кнопку видео (приоритет выше)
    // Проверяем и саму кнопку, и её родительские элементы
    const videoBtn = e.target.closest("[data-video]");
    if (videoBtn) {
      return; // Обработчик видео уже обработал этот клик
    }

    // Категории (dropdown)
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
      if (cat === "all") url.searchParams.delete("category"); else url.searchParams.set("category", cat);
      window.location.href = url.toString();
      return;
    }
    if (dropdown && !e.target.closest(".category-dropdown")) {
      dropdown.classList.remove("open");
      dropdown.setAttribute("aria-hidden", "true");
    }

    const likeBtn = e.target.closest(".like-btn");
    const dislikeBtn = e.target.closest(".dislike-btn");

    if (likeBtn || dislikeBtn) {
      if (!window.IS_AUTH) {
        // Предложим регистрацию
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
      if (ratingBlock.dataset.voted === "true") {
        // Уже голосовал — блокируем повтор
        return;
      }

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
          // 🔹 обновляем результат (лайки − дизлайки)
          resultEl.textContent = String(data.result);
          // 🔹 обновляем количество голосов
          votesEl.textContent = `(${data.total} голосов)`;
          // 🔹 помечаем, что голос отдан
          ratingBlock.dataset.voted = "true";
          ratingBlock.querySelectorAll("button").forEach(b => b.disabled = true);
        } else {
          console.warn("⚠️ Сервер вернул ошибку:", data.message || data.error);
          if (res.status === 401) {
            alert("Голосование доступно только зарегистрированным пользователям");
          }
          if (res.status === 409) {
            ratingBlock.dataset.voted = "true";
            ratingBlock.querySelectorAll("button").forEach(b => b.disabled = true);
          }
        }
      } catch (err) {
        console.error("❌ Ошибка сохранения рейтинга:", err);
      }
    }
  });
});
