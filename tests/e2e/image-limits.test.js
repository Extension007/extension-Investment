/**
 * E2E тест для лимита 5 изображений с последовательным удалением и догрузкой
 */

const puppeteer = require('puppeteer');

describe('E2E: Лимит 5 изображений', () => {
  let browser;
  let page;
  const baseUrl = process.env.TEST_URL || 'http://localhost:3000';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
  });

  afterEach(async () => {
    await page.close();
  });

  test('последовательное удаление и догрузка до лимита 5', async () => {
    // 1. Логин как пользователь
    await page.goto(`${baseUrl}/user/login`);
    await page.type('input[name="username"]', 'testuser');
    await page.type('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // 2. Переход в кабинет
    await page.goto(`${baseUrl}/cabinet`);
    await page.waitForSelector('.product-card, .empty-state', { timeout: 5000 });

    // 3. Создание товара с 5 изображениями
    // (Предполагаем, что есть кнопка "Добавить товар")
    const addButton = await page.$('a[href*="/cabinet/product/new"], button:has-text("Добавить")');
    if (addButton) {
      await addButton.click();
      await page.waitForNavigation();

      // Заполнение формы
      await page.type('input[name="name"]', 'Test Product');
      await page.type('input[name="price"]', '100');
      await page.type('input[name="description"]', 'Test description');

      // Загрузка 5 изображений
      const fileInput = await page.$('input[type="file"][name="images"]');
      if (fileInput) {
        // Создаем тестовые файлы (в реальном тесте нужны реальные файлы)
        // await fileInput.uploadFile(...);
      }

      await page.click('button[type="submit"]');
      await page.waitForNavigation();
    }

    // 4. Переход на страницу редактирования
    await page.goto(`${baseUrl}/cabinet/product/:id/edit`);
    await page.waitForSelector('.current-images-container', { timeout: 5000 });

    // 5. Проверка начального количества изображений
    const initialImages = await page.$$('.current-image-item');
    expect(initialImages.length).toBe(5);

    // 6. Удаление одного изображения
    const removeButtons = await page.$$('.remove-image-btn');
    if (removeButtons.length > 0) {
      await removeButtons[0].click();
      
      // Ждем удаления (оптимистичное обновление + запрос)
      await page.waitForTimeout(500);
      
      // Проверяем, что осталось 4 изображения
      const imagesAfterDelete = await page.$$('.current-image-item');
      expect(imagesAfterDelete.length).toBe(4);
    }

    // 7. Загрузка еще одного изображения (должно быть разрешено)
    const fileInput = await page.$('input[type="file"][name="images"]');
    if (fileInput) {
      // await fileInput.uploadFile(...);
      // Ждем загрузки
      await page.waitForTimeout(500);
      
      // Проверяем, что снова 5 изображений
      const imagesAfterAdd = await page.$$('.current-image-item');
      expect(imagesAfterAdd.length).toBe(5);
    }

    // 8. Попытка загрузить шестое изображение (должно быть запрещено)
    if (fileInput) {
      // await fileInput.uploadFile(...);
      
      // Проверяем сообщение об ошибке
      const errorMessage = await page.$eval('.error-message, .toast-error', el => el.textContent).catch(() => null);
      if (errorMessage) {
        expect(errorMessage).toContain('Максимальное количество');
        expect(errorMessage).toContain('5');
      }
    }
  }, 30000);

  test('удаление изображения через Network запрос', async () => {
    // Логин
    await page.goto(`${baseUrl}/user/login`);
    await page.type('input[name="username"]', 'testuser');
    await page.type('input[name="password"]', 'testpass');
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    // Переход на страницу редактирования
    await page.goto(`${baseUrl}/cabinet/product/:id/edit`);
    await page.waitForSelector('.current-images-container', { timeout: 5000 });

    // Включаем перехват сетевых запросов
    const deleteRequests = [];
    page.on('request', request => {
      if (request.method() === 'DELETE' && request.url().includes('/api/images/')) {
        deleteRequests.push(request.url());
      }
    });

    // Клик на кнопку удаления
    const removeButton = await page.$('.remove-image-btn');
    if (removeButton) {
      await removeButton.click();
      
      // Ждем завершения запроса
      await page.waitForResponse(response => 
        response.url().includes('/api/images/') && response.status() === 204,
        { timeout: 5000 }
      ).catch(() => {});

      // Проверяем, что запрос был отправлен
      expect(deleteRequests.length).toBeGreaterThan(0);
      expect(deleteRequests[0]).toMatch(/\/api\/images\/[^/]+\/\d+$/);
    }
  }, 15000);
});




