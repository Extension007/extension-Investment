// Специальный скрипт для админ-панели
document.addEventListener("DOMContentLoaded", () => {

  // Обработка выхода
  const logoutForm = document.getElementById("logoutForm");
  if (logoutForm) {
    logoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!confirm("Вы уверены, что хотите выйти?")) return;
      try {
        const res = await fetch("/logout", { method: "POST" });
        if (res.ok) {
          window.location.href = "/";
        }
      } catch (err) {
        console.error("Ошибка выхода:", err);
        window.location.href = "/";
      }
    });
  }

  // Блокировка/Разблокировка карточек (товары, услуги, баннеры)
  const toggleBtns = document.querySelectorAll(".toggle-visibility-btn");
  toggleBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const currentStatus = btn.getAttribute("data-status");
      const itemType = btn.getAttribute("data-type") || "product"; // product, service, banner
      const action = (currentStatus === "approved" || currentStatus === "published") ? "заблокировать" : "разблокировать";
      if (!confirm(`Вы уверены, что хотите ${action} эту карточку?`)) return;

      try {
        // Определяем эндпоинт в зависимости от типа
        let endpoint;
        if (itemType === "banner") {
          endpoint = `/admin/banners/${id}/toggle-visibility`;
        } else if (itemType === "service") {
          endpoint = `/admin/services/${id}/toggle-visibility`;
        } else {
          endpoint = `/admin/products/${id}/toggle-visibility`;
        }

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          }
        });
        const data = await res.json();
        if (data.success) {
          alert(data.message || "Статус карточки изменен");
          location.reload();
        } else {
          alert("Ошибка: " + (data.message || "Не удалось изменить статус"));
        }
      } catch (err) {
        console.error("❌ Ошибка блокировки:", err);
        alert("Ошибка сети: " + err.message);
      }
    });
 });

  // Модерация: одобрение
  const approveBtns = document.querySelectorAll(".approve-btn");
  approveBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      if (!confirm("Одобрить эту карточку?")) return;
      try {
        // Определяем эндпоинт в зависимости от типа карточки
        const itemType = btn.getAttribute("data-type") || "product";
        let endpoint;
        if (itemType === "banner") {
          endpoint = `/admin/banners/${id}/approve`;
        } else if (itemType === "service") {
          endpoint = `/admin/services/${id}/approve`;
        } else {
          endpoint = `/admin/products/${id}/approve`;
        }
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          }
        });
        const data = await res.json();
        if (data.success) {
          alert("Карточка одобрена!");
          location.reload();
        } else {
          alert("Ошибка: " + (data.message || "Неизвестная ошибка"));
        }
      } catch (err) {
        console.error("❌ Ошибка одобрения:", err);
        alert("Ошибка сети: " + err.message);
      }
    });
 });

  // Модерация: отклонение
  const rejectModal = document.getElementById("rejectModal");
  const rejectForm = document.getElementById("rejectForm");
  let currentRejectId = null;
  let currentRejectType = "product"; // Тип карточки для отклонения

  document.querySelectorAll(".reject-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      currentRejectId = btn.getAttribute("data-id");
      currentRejectType = btn.getAttribute("data-type") || "product"; // Сохраняем тип для использования в форме
      rejectModal.style.display = "block";
      rejectModal.setAttribute("aria-hidden", "false");
    });
  });

  const closeRejectBtn = document.querySelector("[data-close-reject]");
  if (closeRejectBtn) {
    closeRejectBtn.addEventListener("click", () => {
      rejectModal.style.display = "none";
      rejectModal.setAttribute("aria-hidden", "true");
      rejectForm && rejectForm.reset();
      currentRejectId = null;
      currentRejectType = "product";
    });
  }

  if (rejectForm) {
    rejectForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!currentRejectId) return;
      const reason = new FormData(rejectForm).get("reason") || "Несоответствие правилам публикации";
      try {
        // Определяем эндпоинт в зависимости от типа карточки
        let rejectEndpoint;
        if (currentRejectType === "banner") {
          rejectEndpoint = `/admin/banners/${currentRejectId}/reject`;
        } else if (currentRejectType === "service") {
          rejectEndpoint = `/admin/services/${currentRejectId}/reject`;
        } else {
          rejectEndpoint = `/admin/products/${currentRejectId}/reject`;
        }
        const res = await fetch(rejectEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          },
          body: JSON.stringify({ reason })
        });
        const data = await res.json();
        if (data.success) {
          alert("Карточка отклонена");
          location.reload();
        } else {
          alert("Ошибка: " + (data.message || "Неизвестная ошибка"));
        }
      } catch (err) {
        console.error("Ошибка отклонения:", err);
        alert("Ошибка сети: " + err.message);
      }
    });
 }

  // Модерация баннеров: одобрение
  const approveBannerBtns = document.querySelectorAll(".approve-banner-btn");
  approveBannerBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      if (!confirm("Одобрить этот баннер?")) return;
      try {
        const res = await fetch(`/admin/banners/${id}/approve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
          }
        });
        const data = await res.json();
        if (data.success) {
          alert("Баннер одобрен!");
          location.reload();
        } else {
          alert("Ошибка: " + (data.message || "Неизвестная ошибка"));
        }
      } catch (err) {
        console.error("❌ Ошибка одобрения баннера:", err);
        alert("Ошибка сети: " + err.message);
      }
    });
  });

  // Модерация баннеров: отклонение
 document.querySelectorAll(".reject-banner-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const reason = prompt("Укажите причину отклонения (необязательно):") || "Несоответствие правилам публикации";
      if (reason === null) return; // Пользователь отменил

      (async () => {
        try {
          const res = await fetch(`/admin/banners/${id}/reject`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            },
            body: JSON.stringify({ reason })
          });
          const data = await res.json();
          if (data.success) {
            alert("Баннер отклонен");
            location.reload();
          } else {
            alert("Ошибка: " + (data.message || "Неизвестная ошибка"));
          }
        } catch (err) {
          console.error("Ошибка отклонения баннера:", err);
          alert("Ошибка сети: " + err.message);
        }
      })();
    });
  });

  // Обработка формы создания товара админом
  const adminCreateForm = document.getElementById('adminCreateProductForm');
  const adminCreateMsg = document.getElementById('adminCreateMsg');
  const adminImagesInput = document.getElementById('adminImages');
  const adminImagePreview = document.getElementById('adminImagePreview');

  if (adminCreateForm) {
    adminCreateForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Проверка количества изображений
      if (adminImagesInput && adminImagesInput.files.length > 5) {
        adminCreateMsg.textContent = 'Максимальное количество изображений: 5';
        adminCreateMsg.style.color = '#b00020';
        return;
      }

      adminCreateMsg.textContent = 'Отправка...';
      adminCreateMsg.style.color = '#666';

      const formData = new FormData(adminCreateForm);

      try {
        const res = await fetch('/admin/products', {
          method: 'POST',
          body: formData
        });

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data.success) {
            adminCreateMsg.textContent = 'Товар успешно добавлен!';
            adminCreateMsg.style.color = 'green';
            adminCreateForm.reset();
            adminImagePreview.innerHTML = '';
            adminImagePreview.style.display = 'none';
            setTimeout(() => {
              location.reload();
            }, 1500);
          } else {
            adminCreateMsg.textContent = data.message || 'Ошибка при добавлении товара';
            adminCreateMsg.style.color = '#b00020';
          }
        } else {
          // Если ответ HTML (redirect), перезагружаем страницу
          location.reload();
        }
      } catch (err) {
        adminCreateMsg.textContent = 'Ошибка сети: ' + err.message;
        adminCreateMsg.style.color = '#b00020';
      }
    });
  }

  // Обработка формы создания баннера админом
  const adminCreateBannerForm = document.getElementById('adminCreateBannerForm');
  const adminCreateBannerMsg = document.getElementById('adminCreateBannerMsg');
  const adminBannerImagesInput = document.getElementById('adminBannerImages');
  const adminBannerImagePreview = document.getElementById('adminBannerImagePreview');

  if (adminCreateBannerForm) {
    adminCreateBannerForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Проверка количества изображений
      if (adminBannerImagesInput && adminBannerImagesInput.files.length > 5) {
        adminCreateBannerMsg.textContent = 'Максимальное количество изображений: 5';
        adminCreateBannerMsg.style.color = '#b00020';
        return;
      }

      adminCreateBannerMsg.textContent = 'Отправка...';
      adminCreateBannerMsg.style.color = '#666';

      const formData = new FormData(adminCreateBannerForm);

      try {
        const res = await fetch('/admin/banners', {
          method: 'POST',
          body: formData
        });

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          if (data.success) {
            adminCreateBannerMsg.textContent = '✅ Баннер успешно добавлен!';
            adminCreateBannerMsg.style.color = 'green';
            adminCreateBannerForm.reset();
            adminBannerImagePreview.innerHTML = '';
            adminBannerImagePreview.style.display = 'none';
            setTimeout(() => {
              location.reload();
            }, 1500);
          } else {
            adminCreateBannerMsg.textContent = data.message || 'Ошибка при добавлении баннера';
            adminCreateBannerMsg.style.color = '#b00020';
          }
        } else {
          // Если ответ HTML (redirect), перезагружаем страницу
          location.reload();
        }
      } catch (err) {
        adminCreateBannerMsg.textContent = 'Ошибка сети: ' + err.message;
        adminCreateBannerMsg.style.color = '#b00020';
      }
    });
  }

  // Превью изображений для админ-формы баннеров
  if (adminBannerImagesInput && adminBannerImagePreview) {
    adminBannerImagesInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      const maxFiles = 5;

      if (files.length > maxFiles) {
        alert(`Можно выбрать не более ${maxFiles} изображений`);
        e.target.value = '';
        adminBannerImagePreview.innerHTML = '';
        adminBannerImagePreview.style.display = 'none';
        return;
      }

      adminBannerImagePreview.innerHTML = '';

      if (files.length === 0) {
        adminBannerImagePreview.style.display = 'none';
        return;
      }

      adminBannerImagePreview.style.display = 'grid';
      adminBannerImagePreview.style.gridTemplateColumns = 'repeat(auto-fill, minmax(100px, 1fr))';
      adminBannerImagePreview.style.gap = '10px';
      adminBannerImagePreview.style.marginTop = '10px';

      files.forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          alert(`Файл "${file.name}" слишком большой (максимум 5MB)`);
          return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          const div = document.createElement('div');
          div.style.position = 'relative';
          div.style.aspectRatio = '1';
          div.style.overflow = 'hidden';
          div.style.borderRadius = '8px';
          div.style.border = '2px solid #ddd';

          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';

          div.appendChild(img);
          adminBannerImagePreview.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  // Превью изображений для админ-формы
  if (adminImagesInput && adminImagePreview) {
    adminImagesInput.addEventListener('change', function(e) {
      const files = Array.from(e.target.files);
      const maxFiles = 5;

      if (files.length > maxFiles) {
        alert(`Можно выбрать не более ${maxFiles} изображений`);
        e.target.value = '';
        adminImagePreview.innerHTML = '';
        adminImagePreview.style.display = 'none';
        return;
      }

      adminImagePreview.innerHTML = '';

      if (files.length === 0) {
        adminImagePreview.style.display = 'none';
        return;
      }

      adminImagePreview.style.display = 'grid';

      files.forEach((file) => {
        if (file.size > 5 * 1024 * 1024) {
          alert(`Файл "${file.name}" слишком большой (максимум 5MB)`);
          return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
          const div = document.createElement('div');
          div.style.position = 'relative';
          div.style.aspectRatio = '1';
          div.style.overflow = 'hidden';
          div.style.borderRadius = '8px';
          div.style.border = '2px solid #ddd';

          const img = document.createElement('img');
          img.src = e.target.result;
          img.style.width = '100%';
          img.style.height = '100%';
          img.style.objectFit = 'cover';

          div.appendChild(img);
          adminImagePreview.appendChild(div);
        };
        reader.readAsDataURL(file);
      });
    });
  }
});

// Загрузка YouTube IFrame API
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
