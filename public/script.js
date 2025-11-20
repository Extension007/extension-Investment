let player = null;
let currentVideoId = null;

function extractVideoId(url) {
  if (!url) return null;
  if (url.includes('/embed/')) return url.split('/embed/')[1].split(/[?#]/)[0];
  if (url.includes('/shorts/')) return url.split('/shorts/')[1].split(/[?#]/)[0];
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split(/[?#]/)[0];
  const match = url.match(/[?&]v=([^&]+)/);
  return match ? match[1] : null;
}

function onPlayerReady(event) {
  console.log("✅ Плеер готов");
  if (currentVideoId) {
    event.target.loadVideoById(currentVideoId);
    console.log("✅ Видео загружено автоматически:", currentVideoId);
  }
}

window.onYouTubeIframeAPIReady = function () {
  console.log("✅ YouTube IFrame API готов");
  const videoFrame = document.getElementById('videoFrame');
  const modal = document.getElementById('videoModal');
  
  if (!videoFrame) {
    console.error("❌ Контейнер videoFrame не найден");
    return;
  }
  
  // Временно показываем модалку для инициализации (невидимо для пользователя)
  const wasHidden = modal && modal.style.display === 'none';
  if (wasHidden && modal) {
    modal.style.display = 'block';
    modal.style.visibility = 'hidden';
    modal.style.position = 'absolute';
    modal.style.left = '-9999px';
  }
  
  try {
    player = new YT.Player('videoFrame', {
      width: '100%',
      height: '480',
      playerVars: { rel: 0, playsinline: 1 },
      events: {
        'onReady': onPlayerReady,
        'onError': (e) => console.error("❌ Ошибка плеера:", e.data)
      }
    });
    console.log("✅ Плеер создан успешно");
  } catch (err) {
    console.error("❌ Ошибка создания плеера:", err);
  }
  
  // Скрываем модалку обратно после инициализации
  if (wasHidden && modal) {
    setTimeout(() => {
      modal.style.display = 'none';
      modal.style.visibility = '';
      modal.style.position = '';
      modal.style.left = '';
    }, 100);
  }
};

document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn[data-video]');
  if (!btn) return;

  const url = btn.getAttribute('data-video');
  const videoId = extractVideoId(url);
  if (!videoId) {
    console.error("❌ Не удалось извлечь videoId из URL:", url);
    return;
  }

  currentVideoId = videoId;
  console.log("🎬 Открытие видео:", url);

  const modal = document.getElementById('videoModal');
  if (!modal) {
    console.error("❌ Модалка не найдена");
    return;
  }

  modal.style.display = 'block';
  modal.setAttribute('aria-hidden', 'false');

  if (player && typeof player.loadVideoById === 'function') {
    player.loadVideoById(videoId);
    console.log("✅ Видео загружено:", videoId);
  } else {
    console.warn("⚠️ Плеер ещё не готов, videoId сохранён и загрузится при onReady");
  }
});

// Обработчик закрытия модалки (делегирование событий)
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-video]')) {
    const modal = document.getElementById('videoModal');
    if (!modal) return;
    
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');

    if (player && typeof player.stopVideo === 'function') {
      player.stopVideo();
      console.log("✅ Видео остановлено");
    }
    currentVideoId = null;
  }
});

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
