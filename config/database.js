// Конфигурация подключения к MongoDB
const mongoose = require("mongoose");

const HAS_MONGO_URI = Boolean(process.env.MONGODB_URI);
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;

// Логирование отсутствующих переменных окружения
if (!process.env.MONGODB_URI) {
  console.warn("⚠️  MONGODB_URI не задан. Приложение запущено без БД (каталог пуст, админ/рейтинг отключены).");
}
if (!process.env.SESSION_SECRET) {
  console.warn("⚠️  SESSION_SECRET не задан. Используется значение по умолчанию (небезопасно для production).");
}

// Функция для проверки доступности БД
function hasMongo() {
  return Boolean(process.env.MONGODB_URI) && mongoose.connection.readyState === 1;
}

// Глобальный кеш подключения
global.mongoose = global.mongoose || { conn: null, promise: null };

async function connectDatabase(retries = 5, delay = 5000) {
  console.log('MONGODB_URI set:', Boolean(process.env.MONGODB_URI));
  
  if (!HAS_MONGO_URI) {
    console.warn("⚠️  MONGODB_URI не задан. Приложение запущено без БД (каталог пуст, админ/рейтинг отключены).");
    return { connection: null, isConnected: false };
  }

  // 🔍 Логируем реальное значение переменной окружения
  console.log("🔍 MONGODB_URI:", process.env.MONGODB_URI);

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || !mongoUri.startsWith('mongodb')) {
    console.error("❌ Неверный формат MONGODB_URI. Ожидается строка, начинающаяся с 'mongodb://' или 'mongodb+srv://'");
    console.warn("⚠️  Приложение будет работать без БД");
    return { connection: null, isConnected: false };
  }

  // Проверяем глобальный кеш
  if (global.mongoose.conn) {
    console.log("✅ Используем существующее подключение к MongoDB");
    return { connection: global.mongoose.conn, isConnected: true };
  }

  if (global.mongoose.promise) {
    console.log("⏳ Ожидаем завершения подключения к MongoDB...");
    global.mongoose.conn = await global.mongoose.promise;
    return { connection: global.mongoose.conn, isConnected: true };
  }

  // Повторные попытки подключения
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const start = Date.now();
      const clientPromise = mongoose.connect(process.env.MONGODB_URI, {
        dbName: "extoecosystem",
        keepAlive: true,
        keepAliveInitialDelay: 300000,
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 60000,
        connectTimeoutMS: 30000,
        bufferCommands: false,
        maxPoolSize: 1,
        minPoolSize: 0,
        retryWrites: true,
        retryReads: true,
        w: "majority"
      });

      global.mongoose.promise = clientPromise;
      global.mongoose.conn = await clientPromise;
      
      console.log("⏱️ Время подключения:", Date.now() - start, "мс");
      console.log("✅ MongoDB подключена");
      console.log("📊 Состояние подключения:", mongoose.connection.readyState, "(1=connected)");
      console.log("📊 Имя базы данных:", mongoose.connection.name);
      return { connection: global.mongoose.conn, isConnected: true };
    } catch (err) {
      console.error(`❌ Попытка ${attempt} не удалась:`, err.message);
      
      // Детальная диагностика ошибок
      if (err.message.includes('authentication')) {
        console.error("⚠️  Проблема с аутентификацией. Проверьте username и password в MONGODB_URI");
        console.error("💡 Решение: Убедитесь, что пользователь существует в MongoDB Atlas и имеет права на чтение/запись");
      } else if (err.message.includes('timeout')) {
        console.error("⚠️  Таймаут подключения. Возможные причины:");
        console.error("   - Неправильный IP в Network Access MongoDB Atlas");
        console.error("   - Проблемы с сетью в Vercel");
        console.error("   - Блокировка брандмауэром");
        console.error("💡 Решение: Добавьте IP 0.0.0.0/0 в Network Access для тестирования");
      } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
        console.error("⚠️  Проблема с DNS. Проверьте правильность hostname в MONGODB_URI");
        console.error("💡 Решение: Скопируйте URI напрямую из MongoDB Atlas");
      } else if (err.message.includes('ECONNREFUSED')) {
        console.error("⚠️  Соединение отклонено. Проверьте:");
        console.error("   - Доступность MongoDB сервера");
        console.error("   - Правильность порта");
        console.error("💡 Решение: Проверьте URI и настройки сети");
      } else if (err.message.includes('not master')) {
        console.error("⚠️  Ошибка репликации. MongoDB Atlas не может выбрать primary");
        console.error("💡 Решение: Проверьте статус кластера в MongoDB Atlas");
      } else if (err.message.includes('TLS')) {
        console.error("⚠️  Проблема с TLS/SSL соединением");
        console.error("💡 Решение: Убедитесь, что URI содержит ssl=true или использует mongodb+srv://");
      }
      
      if (attempt < retries) {
        console.log(`⏳ Повтор через ${delay} мс...`);
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }

  console.error("❌ Все попытки подключения исчерпаны");
  console.warn("⚠️  Приложение будет работать без БД (каталог пуст, админ/рейтинг отключены).");
  global.mongoose.conn = null;
  global.mongoose.promise = null;
  return { connection: null, isConnected: false };
}

// Обработчики событий подключения
if (HAS_MONGO_URI) {
  mongoose.connection.on('connecting', () => {
    console.log("🔄 Подключение к MongoDB...");
  });

  mongoose.connection.on('connected', () => {
    console.log("✅ MongoDB подключена (событие)");
  });

  mongoose.connection.on('error', (err) => {
    console.error("❌ Ошибка MongoDB:", err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn("⚠️  MongoDB отключена");
    global.mongoose.conn = null;
    global.mongoose.promise = null;
  });

  mongoose.connection.on('reconnected', () => {
    console.log("🔄 MongoDB переподключена");
  });
}

module.exports = {
  connectMongoDB: connectDatabase,
  hasMongo,
  HAS_MONGO: HAS_MONGO_URI
};
