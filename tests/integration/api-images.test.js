/**
 * Интеграционные тесты для API эндпоинта DELETE /api/images/:productId/:imageIndex
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const Product = require('../../models/Product');
const User = require('../../models/User');

describe('DELETE /api/images/:productId/:imageIndex', () => {
  let adminUser;
  let regularUser;
  let product;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    // Подключение к тестовой БД
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/test');
    }
  });

  beforeEach(async () => {
    // Очистка БД
    await Product.deleteMany({});
    await User.deleteMany({});

    // Создание тестовых пользователей
    const bcrypt = require('bcryptjs');
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    adminUser = await User.create({
      username: 'admin',
      email: 'admin@test.com',
      password_hash: adminPassword,
      role: 'admin'
    });

    regularUser = await User.create({
      username: 'user',
      email: 'user@test.com',
      password_hash: userPassword,
      role: 'user'
    });

    // Создание тестового товара
    product = await Product.create({
      name: 'Test Product',
      price: 100,
      images: [
        'https://res.cloudinary.com/test/image/upload/v1/image1.jpg',
        'https://res.cloudinary.com/test/image/upload/v1/image2.jpg',
        'https://res.cloudinary.com/test/image/upload/v1/image3.jpg'
      ],
      image_url: 'https://res.cloudinary.com/test/image/upload/v1/image1.jpg',
      owner: regularUser._id,
      status: 'approved'
    });

    // Мокаем сессии (в реальном приложении это делается через cookies)
    adminToken = `admin-session-${adminUser._id}`;
    userToken = `user-session-${regularUser._id}`;
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  describe('Успешное удаление', () => {
    test('возвращает 204 при успешном удалении', async () => {
      // Мокаем сессию админа
      const session = { user: { _id: adminUser._id.toString(), role: 'admin' } };
      
      const response = await request(app)
        .delete(`/api/images/${product._id}/0`)
        .set('Cookie', `connect.sid=${adminToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(204);

      // Проверяем, что изображение удалено из БД
      const updated = await Product.findById(product._id);
      expect(updated.images).toHaveLength(2);
      expect(updated.images).not.toContain('https://res.cloudinary.com/test/image/upload/v1/image1.jpg');
      expect(updated.image_url).toBe('https://res.cloudinary.com/test/image/upload/v1/image2.jpg');
    });

    test('удаляет последнее изображение и обновляет image_url на null', async () => {
      // Оставляем только одно изображение
      product.images = ['https://res.cloudinary.com/test/image/upload/v1/image1.jpg'];
      product.image_url = 'https://res.cloudinary.com/test/image/upload/v1/image1.jpg';
      await product.save();

      const session = { user: { _id: adminUser._id.toString(), role: 'admin' } };
      
      await request(app)
        .delete(`/api/images/${product._id}/0`)
        .set('Cookie', `connect.sid=${adminToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(204);

      const updated = await Product.findById(product._id);
      expect(updated.images).toHaveLength(0);
      expect(updated.image_url).toBeNull();
    });
  });

  describe('Ошибки', () => {
    test('возвращает 404 если товар не найден', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      await request(app)
        .delete(`/api/images/${fakeId}/0`)
        .set('Cookie', `connect.sid=${adminToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(404)
        .expect(res => {
          expect(res.body.message).toContain('Товар не найден');
        });
    });

    test('возвращает 403 если нет прав доступа', async () => {
      // Создаем товар другого пользователя
      const otherUser = await User.create({
        username: 'other',
        email: 'other@test.com',
        password_hash: await require('bcryptjs').hash('pass', 10),
        role: 'user'
      });

      const otherProduct = await Product.create({
        name: 'Other Product',
        price: 100,
        images: ['https://res.cloudinary.com/test/image/upload/v1/image1.jpg'],
        owner: otherUser._id,
        status: 'approved'
      });

      // Пытаемся удалить как обычный пользователь (не владелец)
      await request(app)
        .delete(`/api/images/${otherProduct._id}/0`)
        .set('Cookie', `connect.sid=${userToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(403)
        .expect(res => {
          expect(res.body.message).toContain('Доступ запрещен');
        });
    });

    test('возвращает 401 если нет авторизации', async () => {
      await request(app)
        .delete(`/api/images/${product._id}/0`)
        .set('X-CSRF-Token', 'test-token')
        .expect(401)
        .expect(res => {
          expect(res.body.message).toContain('Необходима авторизация');
        });
    });

    test('возвращает 400 если индекс вне диапазона', async () => {
      const session = { user: { _id: adminUser._id.toString(), role: 'admin' } };
      
      await request(app)
        .delete(`/api/images/${product._id}/10`)
        .set('Cookie', `connect.sid=${adminToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain('Индекс изображения вне диапазона');
        });
    });

    test('возвращает 400 если индекс отрицательный', async () => {
      const session = { user: { _id: adminUser._id.toString(), role: 'admin' } };
      
      await request(app)
        .delete(`/api/images/${product._id}/-1`)
        .set('Cookie', `connect.sid=${adminToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(400)
        .expect(res => {
          expect(res.body.message).toContain('Неверный индекс изображения');
        });
    });
  });

  describe('Права доступа', () => {
    test('владелец может удалять свои изображения', async () => {
      await request(app)
        .delete(`/api/images/${product._id}/0`)
        .set('Cookie', `connect.sid=${userToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(204);

      const updated = await Product.findById(product._id);
      expect(updated.images).toHaveLength(2);
    });

    test('админ может удалять любые изображения', async () => {
      await request(app)
        .delete(`/api/images/${product._id}/0`)
        .set('Cookie', `connect.sid=${adminToken}`)
        .set('X-CSRF-Token', 'test-token')
        .expect(204);
    });
  });
});




