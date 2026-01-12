// Скрипт миграции на новую систему категорий
require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Banner = require('../models/Banner');
const { HIERARCHICAL_CATEGORIES, FLAT_CATEGORIES } = require('../config/categories');

async function migrateCategories() {
  try {
    console.log('🚀 Начинаем миграцию категорий...');

    // Подключение к MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Подключено к MongoDB');

    // Очищаем существующие категории
    await Category.deleteMany({});
    console.log('🧹 Очищены существующие категории');

    // Создаем карту для хранения ID категорий
    const categoryIdMap = new Map();

    // Рекурсивная функция для создания категорий
    async function createCategories(categories, parentId = null, type = 'all') {
      for (const [key, value] of Object.entries(categories)) {
        const category = new Category({
          name: value.label,
          parentId: parentId,
          type: type,
          icon: getIconForCategory(key),
          description: '',
          order: 0,
          isActive: true,
          createdBy: null
        });

        await category.save();
        categoryIdMap.set(key, category._id);
        console.log(`✅ Создана категория: ${category.name} (${category._id})`);

        // Создаем подкатегории
        if (value.children) {
          await createCategories(value.children, category._id, type);
        }
      }
    }

    // Создаем основные категории для разных типов
    console.log('📁 Создаем категории для товаров...');
    await createCategories(HIERARCHICAL_CATEGORIES, null, 'product');

    console.log('📁 Создаем категории для услуг...');
    await createCategories(HIERARCHICAL_CATEGORIES, null, 'service');

    console.log('📁 Создаем категории для баннеров...');
    await createCategories(HIERARCHICAL_CATEGORIES, null, 'banner');

    // Обновляем существующие товары
    console.log('🔄 Обновляем товары...');
    const products = await Product.find({}).lean();
    let updatedProducts = 0;

    for (const product of products) {
      if (product.category && categoryIdMap.has(product.category)) {
        await Product.findByIdAndUpdate(product._id, {
          categoryId: categoryIdMap.get(product.category)
        });
        updatedProducts++;
      }
    }
    console.log(`✅ Обновлено товаров: ${updatedProducts}`);

    // Обновляем существующие баннеры
    console.log('🔄 Обновляем баннеры...');
    const banners = await Banner.find({}).lean();
    let updatedBanners = 0;

    for (const banner of banners) {
      if (banner.category && categoryIdMap.has(banner.category)) {
        await Banner.findByIdAndUpdate(banner._id, {
          categoryId: categoryIdMap.get(banner.category)
        });
        updatedBanners++;
      }
    }
    console.log(`✅ Обновлено баннеров: ${updatedBanners}`);

    console.log('🎉 Миграция завершена успешно!');
    console.log(`📊 Создано категорий: ${categoryIdMap.size}`);
    console.log(`📊 Обновлено товаров: ${updatedProducts}`);
    console.log(`📊 Обновлено баннеров: ${updatedBanners}`);

  } catch (error) {
    console.error('❌ Ошибка миграции:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📪 Отключено от MongoDB');
  }
}

// Функция для получения иконки для категории (убраны иконки)
function getIconForCategory(key) {
  // Возвращаем пустую строку вместо иконок
  return '';
}

// Запуск миграции
if (require.main === module) {
  migrateCategories();
}

module.exports = { migrateCategories };
