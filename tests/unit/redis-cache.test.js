const cacheManager = require('../../utils/cache');

describe('Redis Cache Manager', () => {
 beforeAll(async () => {
    // Убедимся, что Redis клиент подключен
    await cacheManager.connect();
  });

 test('should store and retrieve data from cache', async () => {
    const key = 'test-key';
    const value = { test: 'data', number: 123 };

    // Сохраняем данные в кэш
    const setResult = await cacheManager.set(key, value);
    expect(setResult).toBe(true);

    // Получаем данные из кэша
    const cachedValue = await cacheManager.get(key);
    expect(cachedValue).toEqual(value);
  });

  test('should return null for non-existent key', async () => {
    const nonExistentKey = 'non-existent-key';
    const result = await cacheManager.get(nonExistentKey);
    expect(result).toBeNull();
  });

  test('should delete data from cache', async () => {
    const key = 'delete-test-key';
    const value = 'delete-test-value';

    // Сохраняем данные
    await cacheManager.set(key, value);
    let result = await cacheManager.get(key);
    expect(result).toEqual(value);

    // Удаляем данные
    const deleteResult = await cacheManager.delete(key);
    expect(deleteResult).toBe(true);

    // Проверяем, что данных больше нет
    result = await cacheManager.get(key);
    expect(result).toBeNull();
  });

 test('should check if key exists in cache', async () => {
    const key = 'exists-test-key';
    const value = 'exists-test-value';

    // Ключ не должен существовать
    let exists = await cacheManager.has(key);
    expect(exists).toBe(false);

    // Сохраняем данные
    await cacheManager.set(key, value);

    // Ключ должен существовать
    exists = await cacheManager.has(key);
    expect(exists).toBe(true);
  });

  test('should cache function results', async () => {
    const key = 'function-cache-test';
    let callCount = 0;

    const testFunction = async () => {
      callCount++;
      return { result: 'function-result', callCount };
    };

    // Первый вызов - функция должна быть вызвана
    const result1 = await cacheManager.cacheFunction(key, testFunction);
    expect(result1.callCount).toBe(1);

    // Второй вызов с тем же ключом - функция не должна быть вызвана снова
    const result2 = await cacheManager.cacheFunction(key, testFunction);
    expect(result2.callCount).toBe(1); // callCount не увеличился
    expect(result1).toEqual(result2);
  });

  afterAll(async () => {
    // Очищаем тестовые данные
    await cacheManager.delete('test-key');
    await cacheManager.delete('delete-test-key');
    await cacheManager.delete('exists-test-key');
    await cacheManager.delete('function-cache-test');
  });
});