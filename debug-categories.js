// Простой скрипт для проверки работы API категорий
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

async function debugCategories() {
  try {
    // Подключение к MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/albamount');
    console.log('✅ Подключено к MongoDB');

    // Получаем дерево категорий для товаров
    console.log('\n📁 Дерево категорий для товаров:');
    const productTree = await Category.getTree('product');
    console.log(JSON.stringify(productTree, null, 2));

    // Получаем плоский список
    console.log('\n📋 Плоский список категорий для товаров:');
    const productFlat = await Category.getFlatList('product');
    console.log(JSON.stringify(productFlat, null, 2));

    // Проверяем количество категорий
    const totalCategories = await Category.countDocuments();
    console.log(`\n📊 Всего категорий в БД: ${totalCategories}`);

    const productCategories = await Category.countDocuments({ type: 'product' });
    console.log(`📊 Категорий для товаров: ${productCategories}`);

    const serviceCategories = await Category.countDocuments({ type: 'service' });
    console.log(`📊 Категорий для услуг: ${serviceCategories}`);

    const bannerCategories = await Category.countDocuments({ type: 'banner' });
    console.log(`📊 Категорий для баннеров: ${bannerCategories}`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 Отключено от MongoDB');
  }
}

debugCategories();
