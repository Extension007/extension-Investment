document.addEventListener("DOMContentLoaded", () => {
  // 🔹 Модальное окно для видео
  const modal = document.getElementById("videoModal");
  const videoFrame = document.getElementById("videoFrame");
  const closeBtn = document.querySelector(".modal .close");

  if (modal && videoFrame && closeBtn) {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".product-review");
      if (!btn) return;

      const rawUrl = btn.getAttribute("data-video")?.trim();
      if (!rawUrl) return;

      const embedUrl = toYouTubeEmbed(rawUrl);
      if (!embedUrl) return;

      videoFrame.src = embedUrl + (embedUrl.includes("?") ? "&autoplay=1" : "?autoplay=1");
      modal.style.display = "block";
      modal.setAttribute("aria-hidden", "false");
      trapFocus(modal);
    });

    closeBtn.addEventListener("click", closeModal);
    window.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.style.display === "block") closeModal(); });

    function closeModal() {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      videoFrame.src = "";
      releaseFocus();
    }

    function toYouTubeEmbed(url) {
      try {
        const u = new URL(url);
        const host = u.hostname.replace(/^www\./, "");
        if (host.includes("youtube.com")) {
          if (u.pathname === "/watch") {
            const id = u.searchParams.get("v");
            return id ? `https://www.youtube.com/embed/${id}` : null;
          }
          if (u.pathname.startsWith("/embed/")) return url;
          if (u.pathname.startsWith("/shorts/")) {
            const id = u.pathname.split("/shorts/")[1];
            return id ? `https://www.youtube.com/embed/${id}` : null;
          }
        }
        if (host === "youtu.be") {
          const id = u.pathname.slice(1);
          return id ? `https://www.youtube.com/embed/${id}` : null;
        }
        return null;
      } catch {
        return null;
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
    const likeBtn = e.target.closest(".like-btn");
    const dislikeBtn = e.target.closest(".dislike-btn");

    if (likeBtn || dislikeBtn) {
      const ratingBlock = e.target.closest(".product-rating");
      if (!ratingBlock) return;

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
        } else {
          console.warn("⚠️ Сервер вернул ошибку:", data.message || data.error);
        }
      } catch (err) {
        console.error("❌ Ошибка сохранения рейтинга:", err);
      }
    }
  });
});
