// Утилиты для работы с кэшем Redis
const { redisClient, hasRedis } = require('../config/redis');

class CacheManager {
  constructor() {
    this.client = redisClient;
    this.hasRedis = hasRedis;
    this.prefix = 'exto:';
  }

 async connect() {
    if (this.hasRedis && !this.client.isOpen) {
      await this.client.connect();
    }
  }

  // Получение данных из кэша
  async get(key) {
    try {
      if (!this.hasRedis) {
        return null; // Если Redis не настроен, возвращаем null
      }
      
      await this.connect();
      const data = await this.client.get(this.prefix + key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Ошибка получения из кэша:', error.message);
      return null;
    }
  }

  // Сохранение данных в кэш
  async set(key, value, ttl = 3600) { // по умолчанию 1 час
    try {
      if (!this.hasRedis) {
        return true; // Если Redis не настроен, возвращаем true (имитация успешного сохранения)
      }
      
      await this.connect();
      const serializedValue = JSON.stringify(value);
      await this.client.setEx(this.prefix + key, ttl, serializedValue);
      return true;
    } catch (error) {
      console.error('❌ Ошибка сохранения в кэш:', error.message);
      return false;
    }
  }

 // Удаление данных из кэша
  async delete(key) {
    try {
      if (!this.hasRedis) {
        return false; // Если Redis не настроен, возвращаем false
      }
      
      await this.connect();
      const result = await this.client.del(this.prefix + key);
      return result > 0;
    } catch (error) {
      console.error('❌ Ошибка удаления из кэша:', error.message);
      return false;
    }
  }

  // Проверка наличия ключа в кэше
  async has(key) {
    try {
      if (!this.hasRedis) {
        return false; // Если Redis не настроен, возвращаем false
      }
      
      await this.connect();
      const exists = await this.client.exists(this.prefix + key);
      return exists === 1;
    } catch (error) {
      console.error('❌ Ошибка проверки наличия в кэше:', error.message);
      return false;
    }
  }

  // Очистка кэша по шаблону
 async clearPattern(pattern) {
    try {
      if (!this.hasRedis) {
        return 0; // Если Redis не настроен, возвращаем 0
      }
      
      await this.connect();
      const keys = await this.client.keys(this.prefix + pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
      return keys.length;
    } catch (error) {
      console.error('❌ Ошибка очистки кэша по шаблону:', error.message);
      return 0;
    }
 }

  // Кэширование результата функции
  async cacheFunction(key, fn, ttl = 3600) {
    // Проверяем, есть ли данные в кэше
    let cachedData = await this.get(key);
    if (cachedData !== null) {
      return cachedData;
    }

    // Если данных нет в кэше, вызываем функцию
    const result = await fn();
    
    // Сохраняем результат в кэш
    await this.set(key, result, ttl);
    
    return result;
 }
}

// Создаем экземпляр кэш-менеджера
const cacheManager = new CacheManager();

module.exports = cacheManager;