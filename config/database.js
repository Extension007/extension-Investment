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

async function connectDatabase() {
  console.log('MONGODB_URI set:', Boolean(process.env.MONGODB_URI));
  
  if (!HAS_MONGO_URI) {
    console.warn("⚠️  MONGODB_URI не задан. Приложение запущено без БД (каталог пуст, админ/рейтинг отключены).");
    return { connection: null, isConnected: false };
  }

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

  // Если есть обещание подключения, ждем его
  if (global.mongoose.promise) {
    console.log("⏳ Ожидаем завершения подключения к MongoDB...");
    global.mongoose.conn = await global.mongoose.promise;
    return { connection: global.mongoose.conn, isConnected: true };
  }

  // Настройка таймаутов в зависимости от среды
  const timeoutConfig = isVercel 
    ? {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 10000,
        connectTimeoutMS: 5000,
        maxPoolSize: 1
      }
    : {
        serverSelectionTimeoutMS: isProduction ? 30000 : 10000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: isProduction ? 30000 : 10000,
        maxPoolSize: 10
      };

  // Создаем новое подключение
  const clientPromise = mongoose.connect(mongoUri, {
    ...timeoutConfig,
    bufferCommands: false,
    // Убраны устаревшие опции: useNewUrlParser, useUnifiedTopology
    retryWrites: true,
    w: 'majority'
  });

  global.mongoose.promise = clientPromise;

  try {
    global.mongoose.conn = await clientPromise;
    console.log("✅ MongoDB подключена");
    console.log("📊 Состояние подключения:", mongoose.connection.readyState, "(1=connected)");
    console.log("📊 Имя базы данных:", mongoose.connection.name);
    return { connection: global.mongoose.conn, isConnected: true };
  } catch (err) {
    console.error("❌ Ошибка подключения MongoDB:", err.message);
    console.error("❌ Тип ошибки:", err.name);
    console.error("❌ Stack trace:", err.stack);
    
    if (err.message.includes('authentication')) {
      console.error("⚠️  Проблема с аутентификацией. Проверьте username и password в MONGODB_URI");
    } else if (err.message.includes('timeout')) {
      console.error("⚠️  Таймаут подключения. Проверьте Network Access в MongoDB Atlas");
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
      console.error("⚠️  Проблема с DNS. Проверьте правильность hostname в MONGODB_URI");
    }
    
    console.warn("⚠️  Приложение будет работать без БД (каталог пуст, админ/рейтинг отключены).");
    global.mongoose.conn = null;
    global.mongoose.promise = null;
    return { connection: null, isConnected: false };
  }
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
    // Сбрасываем глобальный кеш при отключении
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
