/**
 * Юнит-тесты для функции removeImageByIndex
 * Тестирует оптимистичное обновление UI, отправку запроса и откат при ошибке
 */

describe('removeImageByIndex', () => {
  let mockFetch;
  let currentImages;
  let formConfig;
  let container;
  let showToast;

  beforeEach(() => {
    // Мокаем fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

    // Мокаем глобальные функции из edit-form.js
    global.showToast = jest.fn();
    global.updateImageIndexes = jest.fn();
    global.updateCurrentImages = jest.fn();
    global.getCsrfToken = jest.fn(() => 'test-csrf-token');

    // Мокаем DOM элементы
    document.body.innerHTML = `
      <div class="current-images-container">
        <div class="image-wrapper" data-image-index="0">
          <img src="image1.jpg" data-original-url="image1.jpg">
          <button class="remove-image-btn" data-image-index="0">×</button>
        </div>
        <div class="image-wrapper" data-image-index="1">
          <img src="image2.jpg" data-original-url="image2.jpg">
          <button class="remove-image-btn" data-image-index="1">×</button>
        </div>
        <div class="image-wrapper" data-image-index="2">
          <img src="image3.jpg" data-original-url="image3.jpg">
          <button class="remove-image-btn" data-image-index="2">×</button>
        </div>
      </div>
      <input type="hidden" id="currentImagesInput" value='["image1.jpg","image2.jpg","image3.jpg"]'>
      <input type="hidden" id="productId" value="test-product-id">
      <meta name="csrf-token" content="test-csrf-token">
    `;

    container = document.querySelector('.current-images-container');
    currentImages = ['image1.jpg', 'image2.jpg', 'image3.jpg'];
    formConfig = { productId: 'test-product-id' };
    showToast = global.showToast;

    // Определяем тестируемую функцию
    global.removeImageByIndex = async (index) => {
      // Валидация индекса
      if (index < 0 || index >= document.querySelectorAll('.image-wrapper').length) {
        showToast('Ошибка: неверный индекс изображения', 'error');
        return;
      }

      const productId = document.querySelector('#productId')?.value;
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

      if (!productId || !csrfToken) {
        showToast('Ошибка: отсутствуют необходимые данные. Обновите страницу', 'error');
        return;
      }

      const wrapper = document.querySelector(`.image-wrapper[data-image-index="${index}"]`);

      if (!wrapper) {
        showToast('Ошибка: элемент изображения не найден', 'error');
        return;
      }

      // Оптимистичное обновление UI
      wrapper.style.opacity = '0.5';
      wrapper.style.pointerEvents = 'none';

      try {
        const res = await fetch(`/api/images/${productId}/${index}`, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken },
          credentials: 'same-origin'
        });

        if (res.ok || res.status === 204) {
          // Удаляем элемент из DOM
          wrapper.remove();
          showToast('Изображение успешно удалено', 'success');
        } else {
          // Rollback
          wrapper.style.opacity = '1';
          wrapper.style.pointerEvents = 'auto';
          showToast('Ошибка при удалении изображения', 'error');
        }
      } catch (err) {
        // Rollback
        wrapper.style.opacity = '1';
        wrapper.style.pointerEvents = 'auto';
        showToast(`Ошибка удаления изображения: ${err.message}`, 'error');
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('при клике отправляется DELETE запрос', async () => {
    // Мокаем успешный ответ
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204
    });

    // Симулируем удаление изображения с индексом 1
    await removeImageByIndex(1);

    // Проверяем, что запрос отправлен
    expect(mockFetch).toHaveBeenCalledWith(
      `/api/images/test-product-id/1`,
      expect.objectContaining({
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'test-csrf-token'
        },
        credentials: 'same-origin'
      })
    );
  });

  test('элемент удаляется из DOM при успехе', async () => {
    const initialWrapperCount = document.querySelectorAll('.image-wrapper').length;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204
    });

    await removeImageByIndex(1);

    // Проверяем, что элемент удален из DOM
    const remainingWrappers = document.querySelectorAll('.image-wrapper');
    expect(remainingWrappers.length).toBe(initialWrapperCount - 1);
    expect(document.querySelector('[data-image-index="1"]')).toBeNull();
  });



  test('откат при ошибке - восстанавливает DOM элемент', async () => {
    const imageItem = container.querySelector('[data-image-index="1"]');
    const originalOpacity = imageItem.style.opacity;

    // Мокаем ошибку
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await removeImageByIndex(1);

    // Проверяем, что элемент восстановлен
    expect(imageItem.style.opacity).toBe('1');
    expect(imageItem.style.pointerEvents).toBe('auto');
  });

  test('показывает toast при успехе', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204
    });

    await removeImageByIndex(1);

    expect(showToast).toHaveBeenCalledWith('Изображение удалено', 'success');
  });

  test('показывает toast при ошибке', async () => {
    const errorMessage = 'Network error';
    mockFetch.mockRejectedValueOnce(new Error(errorMessage));

    await removeImageByIndex(1);

    expect(showToast).toHaveBeenCalledWith(
      `Ошибка удаления изображения: ${errorMessage}`,
      'error'
    );
  });

  test('оптимистичное обновление - элемент становится полупрозрачным', async () => {
    const imageItem = container.querySelector('[data-image-index="1"]');
    
    // Мокаем медленный ответ
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ ok: true, status: 204 }), 100))
    );

    const removePromise = removeImageByIndex(1);

    // Проверяем оптимистичное обновление до завершения запроса
    expect(imageItem.style.opacity).toBe('0.5');
    expect(imageItem.style.pointerEvents).toBe('none');

    await removePromise;
  });

  test('валидация - неверный индекс', async () => {
    await removeImageByIndex(-1);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Ошибка: неверный индекс изображения', 'error');
  });

  test('валидация - индекс вне диапазона', async () => {
    await removeImageByIndex(10);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Ошибка: неверный индекс изображения', 'error');
  });

  test('валидация - отсутствует productId в DOM', async () => {
    // Удаляем productId из DOM
    const productIdInput = document.querySelector('#productId');
    productIdInput.remove();

    await removeImageByIndex(1);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Ошибка: отсутствуют необходимые данные. Обновите страницу', 'error');
  });
});
