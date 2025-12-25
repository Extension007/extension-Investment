// Конфигурация подключения к MongoDB
const mongoose = require("mongoose");

const HAS_MONGO_URI = Boolean(process.env.MONGODB_URI);
const isVercel = Boolean(process.env.VERCEL);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;
let isDbConnected = false;

function connectDatabase() {
  console.log('MONGODB_URI set:', Boolean(process.env.MONGODB_URI));
  if (!HAS_MONGO_URI) {
    console.warn("⚠️  MONGODB_URI не задан. Приложение запущено без БД (каталог пуст, админ/рейтинг отключены).");
    return Promise.resolve(false);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || !mongoUri.startsWith('mongodb')) {
    console.error("❌ Неверный формат MONGODB_URI. Ожидается строка, начинающаяся с 'mongodb://' или 'mongodb+srv://'");
    console.warn("⚠️  Приложение будет работать без БД");
    return Promise.resolve(false);
  }

  // В Vercel serverless подключаемся к глобальному соединению с короткими таймаутами
  if (isVercel) {
    if (mongoose.connection.readyState >= 1) {
      return Promise.resolve({ connection: mongoose.connection, isConnected: true });
    }
    return mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 5000,
      bufferCommands: false,
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 1
    })
      .then(() => {
        console.log("✅ MongoDB подключена (Vercel serverless)");
        return { connection: mongoose.connection, isConnected: true };
      })
      .catch(err => {
        console.error("❌ Ошибка подключения MongoDB (Vercel):", err.message);
        return { connection: null, isConnected: false };
      });
  }

  // В обычной среде используем глобальное соединение
  if (isDbConnected && mongoose.connection.readyState === 1) {
    return Promise.resolve(true);
  }

  const serverTimeout = isProduction ? 30000 : 10000;
  const connectTimeout = isProduction ? 30000 : 10000;

  return mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: serverTimeout,
    socketTimeoutMS: 45000,
    connectTimeoutMS: connectTimeout,
    retryWrites: true,
    w: 'majority'
  })
    .then(() => {
      console.log("✅ MongoDB подключена");
      console.log("📊 Состояние подключения:", mongoose.connection.readyState, "(1=connected)");
      console.log("📊 Имя базы данных:", mongoose.connection.name);
      isDbConnected = true;
      return true;
    })
    .catch(err => {
      console.error("❌ Ошибка подключения MongoDB:", err.message);
      console.error("❌ Тип ошибки:", err.name);
      if (err.message.includes('authentication')) {
        console.error("⚠️  Проблема с аутентификацией. Проверьте username и password в MONGODB_URI");
      } else if (err.message.includes('timeout')) {
        console.error("⚠️  Таймаут подключения. Проверьте Network Access в MongoDB Atlas");
      } else if (err.message.includes('ENOTFOUND') || err.message.includes('DNS')) {
        console.error("⚠️  Проблема с DNS. Проверьте правильность hostname в MONGODB_URI");
      }
      console.warn("⚠️  Приложение будет работать без БД (каталог пуст, админ/рейтинг отключены).");
      isDbConnected = false;
      return false;
    });
}

// Функция для проверки доступности БД
function hasMongo() {
  return HAS_MONGO_URI && isDbConnected;
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
