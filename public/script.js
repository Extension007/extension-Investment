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
          // Используем обычный youtube.com для лучшей совместимости
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

      // Формируем финальный URL с autoplay и mute для автоматического воспроизведения
      // Для YouTube Shorts и обычных видео используем специальные параметры
      // Используем правильные параметры для избежания ошибки 153
      let finalUrl = embedUrl;
      if (finalUrl.includes("?")) {
        finalUrl += "&autoplay=1&mute=1&rel=0&enablejsapi=1&playsinline=1&controls=1";
      } else {
        finalUrl += "?autoplay=1&mute=1&rel=0&enablejsapi=1&playsinline=1&controls=1";
      }
      console.log("🎥 Загрузка видео с autoplay:", finalUrl);
      
      // СНАЧАЛА открываем модальное окно
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");
      console.log("✅ Модальное окно открыто, display:", modal.style.display);
      console.log("📺 modal offsetWidth:", modal.offsetWidth, "offsetHeight:", modal.offsetHeight);
      console.log("📺 modal computed display:", window.getComputedStyle(modal).display);
      
      // Принудительно делаем iframe видимым
      videoFrame.style.display = "block";
      videoFrame.style.visibility = "visible";
      videoFrame.style.opacity = "1";
      
      console.log("📺 videoFrame до загрузки:", videoFrame);
      console.log("📺 videoFrame offsetWidth:", videoFrame.offsetWidth, "offsetHeight:", videoFrame.offsetHeight);
      console.log("📺 videoFrame computed display:", window.getComputedStyle(videoFrame).display);
      
      // Очищаем предыдущий src
      videoFrame.src = "";
      
      // Используем requestAnimationFrame для гарантии, что модальное окно отобразилось
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Двойной requestAnimationFrame гарантирует, что браузер отрисовал модальное окно
          try {
            console.log("🎬 Установка src в iframe...");
            console.log("📺 videoFrame перед установкой src - offsetWidth:", videoFrame.offsetWidth, "offsetHeight:", videoFrame.offsetHeight);
            
            videoFrame.src = finalUrl;
            
            console.log("✅ Видео URL установлен в iframe.src:", videoFrame.src);
            console.log("📺 iframe элемент:", videoFrame);
            console.log("📺 iframe видимый:", videoFrame.offsetWidth > 0 && videoFrame.offsetHeight > 0);
            console.log("📺 iframe computed style display:", window.getComputedStyle(videoFrame).display);
            console.log("📺 iframe computed style visibility:", window.getComputedStyle(videoFrame).visibility);
            console.log("📺 iframe computed style opacity:", window.getComputedStyle(videoFrame).opacity);
            
            // Проверяем через небольшую задержку
            setTimeout(() => {
              const currentSrc = videoFrame.src;
              const isVisible = videoFrame.offsetWidth > 0 && videoFrame.offsetHeight > 0;
              console.log("📺 Проверка через 500мс:");
              console.log("📺 currentSrc:", currentSrc);
              console.log("📺 isVisible:", isVisible);
              
              // Проверяем, загружен ли iframe
              try {
                const iframeWindow = videoFrame.contentWindow;
                const iframeDoc = videoFrame.contentDocument || (iframeWindow && iframeWindow.document);
                console.log("📺 iframe contentWindow:", iframeWindow ? "доступен" : "не доступен");
                console.log("📺 iframe contentDocument:", iframeDoc ? "доступен" : "не доступен (нормально для cross-origin)");
              } catch (e) {
                console.log("📺 iframe cross-origin (нормально):", e.message);
              }
              
              if (currentSrc && currentSrc.includes("youtube") && isVisible) {
                console.log("✅ Видео успешно загружено в iframe и iframe видимый");
                console.log("📺 Финальный src iframe:", currentSrc);
                console.log("📺 iframe готов к воспроизведению");
                console.log("ℹ️  Если видео не воспроизводится, попробуйте:");
                console.log("   1. Нажать кнопку play в плеере YouTube");
                console.log("   2. Проверить, не блокирует ли браузер автовоспроизведение");
                console.log("   3. Проверить, доступно ли видео для встраивания");
                
                // Видео должно автоматически начать воспроизведение
                console.log("🎬 Видео должно начать воспроизведение автоматически (muted)");
                
                // Дополнительная попытка: перезагружаем iframe через небольшую задержку для гарантии
                setTimeout(() => {
                  const currentSrc = videoFrame.src;
                  if (currentSrc && currentSrc.includes("youtube")) {
                    // Перезагружаем iframe для принудительного запуска
                    console.log("🔄 Перезагрузка iframe для принудительного запуска...");
                    const tempSrc = videoFrame.src;
                    videoFrame.src = "";
                    setTimeout(() => {
                      videoFrame.src = tempSrc;
                      console.log("✅ iframe перезагружен:", tempSrc);
                    }, 100);
                  }
                }, 1500);
              } else {
                console.error("❌ Проблема:");
                console.error("  - src установлен:", currentSrc && currentSrc.includes("youtube"));
                console.error("  - iframe видимый:", isVisible);
                console.error("  - Текущий src iframe:", currentSrc);
                if (!isVisible) {
                  console.error("  - iframe не видимый! offsetWidth:", videoFrame.offsetWidth, "offsetHeight:", videoFrame.offsetHeight);
                }
                console.log("📺 Попытка установить src еще раз...");
                videoFrame.src = finalUrl;
              }
            }, 500);
          } catch (err) {
            console.error("❌ Ошибка при установке src:", err);
          }
        });
      });
      
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
