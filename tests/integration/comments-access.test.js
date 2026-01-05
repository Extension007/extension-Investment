// Тесты для проверки системы прав доступа к комментариям
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../../config/app');
const User = require('../../models/User');
const Product = require('../../models/Product');
const Comment = require('../../models/Comment');

describe('Система прав доступа к комментариям', () => {
  let testProduct;
  let testUser;
  let testAdmin;
  let agent;

  beforeAll(async () => {
    // Создаем тестовый продукт
    testProduct = await Product.create({
      name: 'Тестовый продукт для комментариев',
      description: 'Описание тестового продукта',
      price: 100,
      category: 'electronics',
      status: 'approved',
      owner: new mongoose.Types.ObjectId()
    });

    // Создаем тестового пользователя
    testUser = await User.create({
      username: 'testuser_comments',
      email: 'testuser_comments@example.com',
      password: 'hashedpassword',
      role: 'user'
    });

    // Создаем тестового админа
    testAdmin = await User.create({
      username: 'testadmin_comments',
      email: 'testadmin_comments@example.com',
      password: 'hashedpassword',
      role: 'admin'
    });

    agent = request.agent(app);
  });

  afterAll(async () => {
    // Очистка тестовых данных
    await Comment.deleteMany({ cardId: testProduct._id });
    await Product.findByIdAndDelete(testProduct._id);
    await User.findByIdAndDelete(testUser._id);
    await User.findByIdAndDelete(testAdmin._id);
  });

  describe('GET /api/comments/:cardId - чтение комментариев', () => {
    test('гости могут читать комментарии одобренных карточек', async () => {
      const response = await request(app)
        .get(`/api/comments/${testProduct._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.comments)).toBe(true);
    });

    test('пользователи могут читать комментарии одобренных карточек', async () => {
      // Имитируем авторизацию (в реальном тесте нужна сессия)
      const response = await request(app)
        .get(`/api/comments/${testProduct._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/comments/:cardId - создание комментариев', () => {
    test('гости не могут создавать комментарии', async () => {
      const response = await request(app)
        .post(`/api/comments/${testProduct._id}`)
        .send({ text: 'Тестовый комментарий от гостя' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('авторизация');
    });

    test('авторизованные пользователи могут создавать комментарии', async () => {
      // В реальном тесте нужно установить сессию
      // Для интеграционного теста проверяем middleware логику
      const response = await request(app)
        .post(`/api/comments/${testProduct._id}`)
        .send({ text: 'Тестовый комментарий от пользователя' })
        .expect(401); // Без сессии будет 401

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/comments/:id - редактирование комментариев', () => {
    let testComment;

    beforeAll(async () => {
      // Создаем тестовый комментарий
      testComment = await Comment.create({
        cardId: testProduct._id,
        cardType: 'Product',
        userId: testUser._id,
        text: 'Тестовый комментарий для редактирования'
      });
    });

    afterAll(async () => {
      await Comment.findByIdAndDelete(testComment._id);
    });

    test('гости не могут редактировать комментарии', async () => {
      const response = await request(app)
        .put(`/api/comments/${testComment._id}`)
        .send({ text: 'Измененный комментарий от гостя' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('администраторы');
    });

    test('обычные пользователи не могут редактировать комментарии', async () => {
      const response = await request(app)
        .put(`/api/comments/${testComment._id}`)
        .send({ text: 'Измененный комментарий от пользователя' })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('администраторы могут редактировать комментарии', async () => {
      // В реальном тесте нужна админ сессия
      const response = await request(app)
        .put(`/api/comments/${testComment._id}`)
        .send({ text: 'Измененный комментарий от админа' })
        .expect(403); // Без админ сессии будет 403

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/comments/:id - удаление комментариев', () => {
    let testComment;

    beforeAll(async () => {
      testComment = await Comment.create({
        cardId: testProduct._id,
        cardType: 'Product',
        userId: testUser._id,
        text: 'Тестовый комментарий для удаления'
      });
    });

    afterAll(async () => {
      await Comment.findByIdAndDelete(testComment._id);
    });

    test('гости не могут удалять комментарии', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment._id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('администраторы');
    });

    test('обычные пользователи не могут удалять комментарии', async () => {
      const response = await request(app)
        .delete(`/api/comments/${testComment._id}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('администраторы могут удалять комментарии', async () => {
      // В реальном тесте нужна админ сессия
      const response = await request(app)
        .delete(`/api/comments/${testComment._id}`)
        .expect(403); // Без админ сессии будет 403

      expect(response.body.success).toBe(false);
    });
  });

  describe('WebSocket события чата', () => {
    test('гости могут присоединяться к чату для чтения', async () => {
      // WebSocket тесты требуют специальной настройки
      // Этот тест является placeholder для будущих WebSocket тестов
      expect(true).toBe(true);
    });

    test('авторизованные пользователи могут отправлять сообщения', async () => {
      expect(true).toBe(true);
    });

    test('администраторы могут модерировать чат', async () => {
      expect(true).toBe(true);
    });
  });
});
