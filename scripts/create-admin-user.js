const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function runScript() {
  try {
    // Подключаемся к базе данных
    const mongoose = require('mongoose');
    const databaseConfig = require('../config/database');
    
    const dbConnection = await databaseConfig.connectMongoDB();
    console.log('🔗 Подключение к базе данных установлено');
    
    // Подключаем модель User после подключения к базе данных
    const User = require('../models/User');
    
    // Хэшируем пароль
    const password = 'BagateliA002@';
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Создаем нового администратора
    const adminUser = new User({
      username: 'admin',
      email: 'admin@albamount.xyz',
      password_hash: passwordHash,
      role: 'admin',
      emailVerified: true, // Устанавливаем как подтвержденный, чтобы можно было сразу войти
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Сохраняем в базе данных
    const savedUser = await adminUser.save();
    
    console.log('✅ Администратор успешно создан:');
    console.log('- ID:', savedUser._id);
    console.log('- Username:', savedUser.username);
    console.log('- Email:', savedUser.email);
    console.log('- Role:', savedUser.role);
    console.log('- Email Verified:', savedUser.emailVerified);
    
    console.log('\nТеперь вы можете войти в админ-панель с:');
    console.log('Email: admin@albamount.xyz');
    console.log('Пароль: BagateliA002@');
  } catch (error) {
    console.error('❌ Ошибка при создании администратора:', error.message);
    
    // Если ошибка связана с уникальностью, проверим, существует ли уже такой пользователь
    if (error.code === 11000) {
      console.log('\n💡 Возможно, пользователь с таким email или username уже существует.');
      console.log('Попробуйте найти существующего пользователя в базе данных.');
    }
  } finally {
    // Закрываем соединение с базой данных
    await mongoose.disconnect();
    console.log('🔒 Соединение с базой данных закрыто');
    process.exit(0);
  }
}

// Запускаем создание администратора
runScript().catch(error => {
  console.error('❌ Ошибка при выполнении скрипта:', error.message);
  process.exit(1);
});