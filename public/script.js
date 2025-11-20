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

  // 🔹 Функция преобразования YouTube URL (определяем глобально)
  function toYouTubeEmbed(url) {
    try {
      if (!url || typeof url !== 'string') return null;
      
      url = url.trim();
      
      // Если уже embed URL, извлекаем video ID
      if (url.includes('/embed/')) {
        const embedId = url.match(/embed\/([^?&#]+)/)?.[1];
        if (embedId) {
          // Используем обычный youtube.com для лучшей совместимости
          return `https://www.youtube.com/embed/${embedId}`;
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
        if (videoId) {
          // Для Shorts и обычных видео используем embed формат
          // playsinline=1 будет добавлен позже в параметрах URL
          return `https://www.youtube.com/embed/${videoId}`;
        }
      }
      
      return null;
    } catch (err) {
      console.error("Ошибка преобразования YouTube URL:", err);
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
      
      const embedUrl = toYouTubeEmbed(videoUrl);
      if (!embedUrl) {
        console.error("❌ Не удалось преобразовать URL видео:", videoUrl);
        alert("Некорректная ссылка на видео. Поддерживаются только ссылки YouTube.");
        return;
      }

      console.log("✅ Embed URL:", embedUrl);

      // Определяем, является ли устройство iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      
      // Формируем финальный URL с параметрами
      let finalUrl = embedUrl;
      const params = new URLSearchParams();
      params.set('rel', '0');
      params.set('enablejsapi', '1');
      params.set('playsinline', '1'); // Обязательно для iOS
      params.set('controls', '1');
      
      // Для iOS и Shorts: НЕ добавляем autoplay (iOS блокирует и вызывает ошибку 153)
      // Пользователь должен нажать play вручную
      if (!isIOS) {
        params.set('autoplay', '1');
        params.set('mute', '1');
      }
      
      finalUrl += (finalUrl.includes("?") ? "&" : "?") + params.toString();
      console.log("🎥 Загрузка видео:", finalUrl, isIOS ? "(iOS - без autoplay)" : "(с autoplay)");
      
      // СНАЧАЛА открываем модальное окно
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");
      
      // Принудительно делаем iframe видимым
      videoFrame.style.display = "block";
      videoFrame.style.visibility = "visible";
      videoFrame.style.opacity = "1";
      
      // Очищаем предыдущий src
      videoFrame.src = "";
      
      // КРИТИЧНО для iOS: устанавливаем src СРАЗУ после клика пользователя (user gesture)
      // Это должно быть в том же синхронном стеке вызовов, инициированном пользователем
      if (isIOS) {
        // Для iOS устанавливаем src сразу, без задержек
        // Это важно для избежания ошибки 153
        videoFrame.style.width = "100%";
        videoFrame.style.height = "480px";
        videoFrame.style.position = "relative";
        videoFrame.style.zIndex = "1";
        
        // Устанавливаем src сразу после открытия модального окна
        // Используем requestAnimationFrame только для гарантии отрисовки, но без задержек
        requestAnimationFrame(() => {
          videoFrame.src = finalUrl;
          console.log("✅ Видео URL установлен в iframe.src (iOS):", videoFrame.src);
        });
      } else {
        // Для не-iOS устройств можно использовать небольшую задержку
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            videoFrame.src = finalUrl;
            console.log("✅ Видео URL установлен в iframe.src:", videoFrame.src);
          });
        });
      }
      
      if (typeof trapFocus === "function") {
        trapFocus(modal);
      }
    }

    // Обработчик клика на кнопки с data-video (используем делегирование с capture phase)
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
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      videoFrame.src = "";
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
