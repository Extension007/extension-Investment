// Демонстрационные данные товаров.
// Замените на свои реальные товары и ссылки.
const products = [];
for (let i = 1; i <= 200; i++) {
  products.push({
    name: `Товар ${i}`,
    price: `${Math.floor(Math.random() * 10000)} ₸`,
    img: `img/product${((i % 3) + 1)}.jpg`, // убедитесь, что такие файлы существуют
    link: `https://partner-site.com/ref=${i}` // замените на свои реферальные ссылки
  });
}

let currentPage = 1;
const itemsPerPage = 75; // 5 x 15

function renderProducts() {
  const grid = document.getElementById("product-grid");
  const pageInfo = document.getElementById("page-info");
  const totalPages = Math.ceil(products.length / itemsPerPage) || 1;

  // Корректируем текущую страницу по границам
  if (currentPage < 1) currentPage = 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageProducts = products.slice(start, end);

  // Очищаем сетку
  grid.innerHTML = "";

  if (pageProducts.length === 0) {
    grid.innerHTML = `<div class="empty-state">Нет товаров для отображения.</div>`;
  } else {
    const frag = document.createDocumentFragment();

    pageProducts.forEach(p => {
      const card = document.createElement("div");
      card.className = "product-card";

      // Формируем содержимое карточки
      card.innerHTML = `
        <img src="${p.img}" alt="${p.name}" loading="lazy">
        <h3>${p.name}</h3>
        <p>Описание ${p.name}</p>
        <span class="price">${p.price}</span>
        <a href="${p.link}" target="_blank" rel="noopener noreferrer">Перейти к продавцу</a>
      `;

      // Важно: не используем onerror для смены изображения на fallback,
      // чтобы избежать лишних перерисовок. Проверьте наличие файлов в img/.
      frag.appendChild(card);
    });

    grid.appendChild(frag);
  }

  // Обновляем текст пагинации
  pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;

  // Обновляем состояние кнопок пагинации
  const prevBtn = document.querySelector(".pagination button:nth-child(1)");
  const nextBtn = document.querySelector(".pagination button:nth-child(3)");
  if (prevBtn && nextBtn) {
    prevBtn.disabled = currentPage <= 1;
    nextBtn.disabled = currentPage >= totalPages;
  }
}

function nextPage() {
  const totalPages = Math.ceil(products.length / itemsPerPage) || 1;
  if (currentPage < totalPages) {
    currentPage++;
    renderProducts();
    scrollCatalogTop();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderProducts();
    scrollCatalogTop();
  }
}

function scrollCatalogTop() {
  const catalog = document.getElementById("catalog");
  if (catalog) catalog.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Первичная отрисовка при загрузке
document.addEventListener("DOMContentLoaded", renderProducts);
