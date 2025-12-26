#!/usr/bin/env node
// Скрипт для диагностики подключения к базе данных
require("dotenv").config();

const mongoose = require("mongoose");

async function diagnoseDB() {
  console.log("🔍 Диагностика подключения к базе данных");
  console.log("=".repeat(50));
  
  // Проверяем переменные окружения
  console.log("📋 Переменные окружения:");
  console.log("  MONGODB_URI:", process.env.MONGODB_URI ? "✅ Задана" : "❌ Не задана");
  console.log("  NODE_ENV:", process.env.NODE_ENV || "undefined");
  console.log("  VERCEL:", process.env.VERCEL ? "✅ Vercel" : "❌ Локально");
  console.log("");
  
  if (!process.env.MONGODB_URI) {
    console.error("❌ MONGODB_URI не задана в переменных окружения!");
    console.log("💡 Решение: Убедитесь, что переменная MONGODB_URI задана в Vercel Environment Variables");
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
  
  // Проверяем подключение
  console.log("🔌 Попытка подключения к MongoDB...");
  
  const timeoutConfig = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 15000,
    connectTimeoutMS: 10000,
    maxPoolSize: 1
  };
  
  try {
    await mongoose.connect(mongoUri, {
      ...timeoutConfig,
      bufferCommands: false,
      retryWrites: true,
      w: 'majority'
    });
    
    console.log("✅ Подключение успешно!");
    console.log("📊 Состояние подключения:", mongoose.connection.readyState, "(1=connected)");
    console.log("📊 Имя базы данных:", mongoose.connection.name);
    console.log("📊 Host:", mongoose.connection.host);
    console.log("📊 Port:", mongoose.connection.port);
    
    // Проверяем доступность коллекций
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("📋 Доступные коллекции:", collections.map(c => c.name));
    
    mongoose.connection.close();
    console.log("✅ Диагностика завершена успешно!");
    
  } catch (err) {
    console.error("❌ Ошибка подключения:", err.message);
    console.error("❌ Тип ошибки:", err.name);
    
    if (err.message.includes('authentication')) {
      console.error("⚠️  Проблема с аутентификацией. Проверьте username и password в MONGODB_URI");
    } else if (err.message.includes('timeout')) {
      console.error("⚠️  Таймаут подключения. Возможные причины:");
      console.error("   - Неправильный IP в Network Access MongoDB Atlas");
      console.error("   - Проблемы с сетью");
      console.error("   - Блокировка брандмауэром");
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
      console.error("⚠️  Проблема с DNS. Проверьте правильность hostname в MONGODB_URI");
    } else if (err.message.includes('ECONNREFUSED')) {
      console.error("⚠️  Соединение отклонено. Проверьте:");
      console.error("   - Доступность MongoDB сервера");
      console.error("   - Правильность порта");
    }
    
    console.log("");
    console.log("💡 Рекомендации по решению:");
    console.log("1. Проверьте Network Access в MongoDB Atlas - добавьте IP 0.0.0.0/0 для тестирования");
    console.log("2. Убедитесь, что username и password в URI корректны");
    console.log("3. Проверьте, что база данных существует");
    console.log("4. Временно уменьшите таймауты для диагностики");
    
    process.exit(1);
  }
}

diagnoseDB().catch(console.error);
