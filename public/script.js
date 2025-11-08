// Логика модального окна для YouTube-видео (работает с серверным рендером EJS)
// Карточки приходят из админки/базы и рендерятся в index.ejs
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("videoModal");
  const videoFrame = document.getElementById("videoFrame");
  const closeBtn = document.querySelector(".modal .close");

  if (!modal || !videoFrame || !closeBtn) {
    console.warn("❌ Модальное окно или элементы не найдены");
    return;
  }

  // Делегирование: открытие модального окна по клику на кнопку "Обзор"
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".product-review");
    if (!btn) return;

    const rawUrl = (btn.getAttribute("data-video") || "").trim();
    console.log("▶️ Клик по кнопке Обзор, ссылка:", rawUrl);

    if (!rawUrl) return;

    const embedUrl = toYouTubeEmbed(rawUrl);
    if (!embedUrl) {
      console.warn("❌ Невалидная ссылка для преобразования:", rawUrl);
      return;
    }

    // Сохраняем оригинальный функционал + автозапуск
    videoFrame.src = embedUrl + (embedUrl.includes("?") ? "&autoplay=1" : "?autoplay=1");
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    trapFocus(modal);
  });

  // Закрытие по крестику
  closeBtn.addEventListener("click", () => closeModal());

  // Закрытие по клику на фон
  window.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Закрытие по Escape
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.style.display === "block") closeModal();
  });

  function closeModal() {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    videoFrame.src = ""; // очищаем, чтобы остановить воспроизведение
    releaseFocus();
  }

  // Преобразование YouTube URL в embed (поддержка watch, youtu.be, embed, shorts)
  function toYouTubeEmbed(url) {
    try {
      const u = new URL(url);

      // Нормализуем хост (убираем www.)
      const host = u.hostname.replace(/^www\./, "");

      if (host.includes("youtube.com")) {
        // https://youtube.com/watch?v=VIDEO_ID
        if (u.pathname === "/watch") {
          const id = u.searchParams.get("v");
          return id ? `https://www.youtube.com/embed/${id}` : null;
        }
        // https://youtube.com/embed/VIDEO_ID
        if (u.pathname.startsWith("/embed/")) {
          // Сохраняем оригинальный функционал — если уже embed, возвращаем как есть
          return url;
        }
        // https://youtube.com/shorts/VIDEO_ID
        if (u.pathname.startsWith("/shorts/")) {
          const id = u.pathname.split("/shorts/")[1];
          return id ? `https://www.youtube.com/embed/${id}` : null;
        }
      }

      // https://youtu.be/VIDEO_ID
      if (host === "youtu.be") {
        const id = u.pathname.slice(1);
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }

      return null;
    } catch {
      return null;
    }
  }

  // Ловушка фокуса внутри модального окна (UX/Accessibility)
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
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  function releaseFocus() {
    if (previousActive && typeof previousActive.focus === "function") {
      previousActive.focus();
    }
  }
});
