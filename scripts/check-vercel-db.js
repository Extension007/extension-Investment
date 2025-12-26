#!/usr/bin/env node
// Скрипт для проверки подключения к базе данных в Vercel среде
require("dotenv").config();

const mongoose = require("mongoose");

async function checkVercelDB() {
  console.log("🔍 Проверка подключения к базе данных в Vercel среде");
  console.log("=".repeat(60));
  
  // Имитируем Vercel окружение
  process.env.VERCEL = '1';
  process.env.NODE_ENV = 'production';
  
  console.log("📋 Переменные окружения Vercel:");
  console.log("  MONGODB_URI:", process.env.MONGODB_URI ? "✅ Задана" : "❌ Не задана");
  console.log("  NODE_ENV:", process.env.NODE_ENV);
  console.log("  VERCEL:", process.env.VERCEL ? "✅ Vercel" : "❌ Локально");
  console.log("");
  
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI не задана в переменных окружения!");
    process.exit(1);
  }
  
  // Проверяем формат URI
  const mongoUri = process.env.MONGODB_URI;
  console.log("🔍 Проверка формата MONGODB_URI:");
  if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
    console.error("❌ Неверный формат MONGODB_URI. Ожидается 'mongodb://' или 'mongodb+srv://'");
    process.exit(1);
  }
  console.log("  ✅ Формат URI корректен");
  console.log("");
  
  // Настройки для Vercel (как в production)
  const timeoutConfig = {
    serverSelectionTimeoutMS: 10000,  // Увеличим таймаут для Vercel
    socketTimeoutMS: 20000,          // Увеличим таймаут сокета
    connectTimeoutMS: 10000,         // Увеличим таймаут подключения
    maxPoolSize: 1,                  // Один соединение для Vercel
    minPoolSize: 0,                  // Минимальное количество соединений
    maxIdleTimeMS: 30000,            // Максимальное время простоя
    waitQueueTimeoutMS: 5000,        // Таймаут ожидания в очереди
    retryWrites: true,
    retryReads: true,
    w: 'majority'
  };
  
  console.log("🔌 Попытка подключения к MongoDB (Vercel конфигурация)...");
  
  try {
    await mongoose.connect(mongoUri, {
      ...timeoutConfig,
      bufferCommands: false
    });
    
    console.log("✅ Подключение успешно!");
    console.log("📊 Состояние подключения:", mongoose.connection.readyState, "(1=connected)");
    console.log("📊 Имя базы данных:", mongoose.connection.name);
    console.log("📊 Host:", mongoose.connection.host);
    console.log("📊 Port:", mongoose.connection.port);
    
    // Проверяем доступность коллекций
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📋 Доступные коллекции:", collections.map(c => c.name));
    
    // Проверяем доступность одной из коллекций
    const userCount = await mongoose.connection.db.collection('users').countDocuments();
    console.log("📊 Количество пользователей:", userCount);
    
    mongoose.connection.close();
    console.log("✅ Диагностика Vercel завершена успешно!");
    
  } catch (err) {
    console.error("❌ Ошибка подключения в Vercel режиме:", err.message);
    console.error("❌ Тип ошибки:", err.name);
    
    if (err.message.includes('authentication')) {
      console.error("⚠️  Проблема с аутентификацией. Проверьте username и password в MONGODB_URI");
    } else if (err.message.includes('timeout')) {
      console.error("⚠️  Таймаут подключения. Возможные причины:");
      console.error("   - Неправильный IP в Network Access MongoDB Atlas");
      console.error("   - Проблемы с сетью в Vercel");
      console.error("   - Блокировка брандмауэром");
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
      console.error("⚠️  Проблема с DNS. Проверьте правильность hostname в MONGODB_URI");
    } else if (err.message.includes('ECONNREFUSED')) {
      console.error("⚠️  Соединение отклонено. Проверьте:");
      console.error("   - Доступность MongoDB сервера");
      console.error("   - Правильность порта");
    }
    
    console.log("");
    console.log("💡 Рекомендации для Vercel:");
    console.log("1. Проверьте Network Access в MongoDB Atlas - добавьте IP 0.0.0.0/0 для тестирования");
    console.log("2. Убедитесь, что username и password в URI корректны");
    console.log("3. Проверьте, что база данных существует");
    console.log("4. Временно уменьшите таймауты для диагностики");
    console.log("5. Проверьте, что в Vercel Environment Variables заданы все необходимые переменные");
    
    process.exit(1);
  }
}

checkVercelDB().catch(console.error);
