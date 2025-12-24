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

  beforeEach(async () => {
    // Загружаем скрипт edit-form.js
    const script = document.createElement('script');
    script.src = 'file://' + require('path').resolve(__dirname, '../../public/js/edit-form.js');
    document.head.appendChild(script);

    // Ждем загрузки скрипта
    await new Promise((resolve) => {
      script.onload = resolve;
      script.onerror = resolve; // Continue even if script fails to load in test environment
    });

    // Мокаем fetch
    mockFetch = jest.fn();
    global.fetch = mockFetch;

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
    showToast = jest.fn();

    // Мокаем функции из edit-form.js
    global.updateImageIndexes = jest.fn();
    global.updateCurrentImages = jest.fn();
    global.getCsrfToken = jest.fn(() => 'test-csrf-token');
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

  test('изображение удаляется из массива при успехе', async () => {
    const originalLength = currentImages.length;
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204
    });

    await removeImageByIndex(1);

    // Проверяем, что изображение удалено из массива
    expect(currentImages.length).toBe(originalLength - 1);
    expect(currentImages).not.toContain('image2.jpg');
    expect(currentImages).toEqual(['image1.jpg', 'image3.jpg']);
  });

  test('откат при ошибке - восстанавливает массив', async () => {
    const originalLength = currentImages.length;
    const originalImages = [...currentImages];

    // Мокаем ошибку
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await removeImageByIndex(1);

    // Проверяем, что массив восстановлен
    expect(currentImages.length).toBe(originalLength);
    expect(currentImages).toEqual(originalImages);
    expect(currentImages).toContain('image2.jpg');
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

  test('валидация - отсутствует productId', async () => {
    formConfig.productId = null;
    
    await removeImageByIndex(1);
    
    expect(mockFetch).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Ошибка: ID товара не найден', 'error');
  });
});
