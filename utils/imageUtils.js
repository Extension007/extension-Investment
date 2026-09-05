// Утилиты для работы с изображениями (Cloudinary и локальное хранилище)
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

// Проверяем наличие Cloudinary переменных
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME && 
  process.env.CLOUDINARY_API_KEY && 
  process.env.CLOUDINARY_API_SECRET
);

// Настройка Cloudinary, если доступен
if (hasCloudinary) {
  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log("✅ Cloudinary настроен для удаления изображений");
  } catch (err) {
    console.warn("⚠️  Ошибка настройки Cloudinary:", err.message);
  }
} else {
  console.log("ℹ️  Cloudinary не настроен, будет использоваться только локальное хранилище");
}

/**
 * Нормализует URL изображения для сравнения (убирает параметры Cloudinary)
 * @param {string} imageUrl - URL изображения
 * @returns {string} - Нормализованный URL
 */
function normalizeImageUrl(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return '';
  }
  
  // Для Cloudinary URL убираем параметры трансформации
  if (imageUrl.includes('cloudinary.com')) {
    // Ищем базовый URL без параметров трансформации
    // Формат: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
    // Нужно получить: https://res.cloudinary.com/{cloud_name}/image/upload/{public_id}.{format}
    const match = imageUrl.match(/^(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(?:v\d+\/)?(?:[^\/]+\/)*([^\/]+\.(jpg|jpeg|png|webp|gif|svg|gif|bmp|tiff|ico))(?:\?.*)?$/i);
    if (match) {
      // Возвращаем базовый URL без трансформаций
      return match[1] + match[2];
    }
    
    // Альтернативный формат: /upload/{transformations}/{public_id}
    const altMatch = imageUrl.match(/\/upload\/(?:v\d+\/)?([^\/]+\.(jpg|jpeg|png|webp|gif|svg|gif|bmp|tiff|ico))(?:\?.*)?$/i);
    if (altMatch) {
      return imageUrl.split('/upload/')[0] + '/upload/' + altMatch[1];
    }
  }
  
  // Для локальных файлов убираем параметры запроса
  return imageUrl.split('?')[0];
}

/**
 * Извлекает public_id из URL Cloudinary
 * @param {string} imageUrl - URL изображения
 * @returns {string|null} - public_id или null, если не Cloudinary URL
 */
function extractCloudinaryPublicId(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return null;
  }
  
  // Нормализуем URL перед извлечением public_id
  const normalized = normalizeImageUrl(imageUrl);
  
  // Упрощённый паттерн: ищем путь после /upload/
  // Формат: /upload/(v{version}/)?{folder}/{public_id}.{format}
  const match = normalized.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/);
  if (match) {
    // Убираем любые дополнительные параметры из public_id
    return match[1].split('?')[0];
  }
  return null;
}

/**
 * Удаляет изображение из хранилища (Cloudinary или локальное)
 * @param {string} imageUrl - URL или путь к изображению
 * @returns {Promise<boolean>} - true если удалено успешно, false в противном случае
 */
async function deleteImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    console.warn("⚠️  Некорректный URL изображения:", imageUrl);
    return false;
  }

  // Проверяем, является ли это Cloudinary URL (начинается с http/https)
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    // Проверяем, что это Cloudinary URL
    if (imageUrl.includes('cloudinary.com') || imageUrl.includes('res.cloudinary.com')) {
      if (!hasCloudinary) {
        console.warn("⚠️  Cloudinary не настроен, но обнаружен Cloudinary URL:", imageUrl);
        return false;
      }

      try {
        const publicId = extractCloudinaryPublicId(imageUrl);
        if (!publicId) {
          console.warn("⚠️  Не удалось извлечь public_id из URL:", imageUrl);
          return false;
        }

        console.log(`🔄 Удаление изображения из Cloudinary: ${publicId}`);
        
        // Retry механизм для временных ошибок Cloudinary
        let result = null;
        let attempts = 3;
        let lastError = null;
        
        while (attempts > 0) {
          try {
            result = await cloudinary.uploader.destroy(publicId);
            break; // Успешно удалено
          } catch (err) {
            lastError = err;
            attempts--;
            if (attempts > 0) {
              console.warn(`⚠️  Ошибка удаления из Cloudinary (попытка ${4 - attempts}/3):`, err.message);
              // Ждем перед повторной попыткой (экспоненциальная задержка)
              await new Promise(resolve => setTimeout(resolve, (4 - attempts) * 1000));
            }
          }
        }
        
        if (!result && lastError) {
          console.error(`❌ Не удалось удалить изображение из Cloudinary после 3 попыток:`, lastError.message);
          return false;
        }
        
        if (result.result === 'ok') {
          console.log(`✅ Изображение успешно удалено из Cloudinary: ${publicId}`);
          return true;
        } else if (result.result === 'not found') {
          console.warn(`⚠️  Изображение не найдено в Cloudinary: ${publicId}`);
          return false;
        } else {
          console.warn(`⚠️  Ошибка удаления из Cloudinary (${result.result}):`, publicId);
          return false;
        }
      } catch (err) {
        console.error(`❌ Ошибка удаления изображения из Cloudinary (${imageUrl}):`, err.message);
        return false;
      }
    } else {
      // Это другой HTTP URL (не Cloudinary) - не можем удалить
      console.warn("⚠️  Обнаружен HTTP URL, но это не Cloudinary. Удаление невозможно:", imageUrl);
      return false;
    }
  } else {
    // Локальное хранилище (путь начинается с /uploads/ или просто имя файла)
    try {
      let filePath = imageUrl;
      
      // Если путь начинается с /uploads/, убираем начальный слэш
      if (filePath.startsWith('/uploads/')) {
        filePath = filePath.substring(1); // Убираем первый слэш -> "uploads/..."
      } else if (filePath.startsWith('uploads/')) {
        // Путь уже начинается с "uploads/" - оставляем как есть
        filePath = filePath;
      } else {
        // Если путь не начинается с uploads/, добавляем префикс
        filePath = path.join('uploads', filePath);
      }
      
      // Формируем полный путь к файлу
      const fullPath = path.join(process.cwd(), filePath);
      
      // Проверяем, что файл находится в папке uploads (безопасность)
      const uploadsDir = path.join(process.cwd(), 'uploads');
      const normalizedFullPath = path.normalize(fullPath);
      const normalizedUploadsDir = path.normalize(uploadsDir);
      
      if (!normalizedFullPath.startsWith(normalizedUploadsDir)) {
        console.warn("⚠️  Попытка удалить файл вне папки uploads:", normalizedFullPath);
        return false;
      }

      // Проверяем существование файла перед удалением
      if (fs.existsSync(normalizedFullPath)) {
        fs.unlinkSync(normalizedFullPath);
        console.log(`✅ Локальный файл успешно удален: ${normalizedFullPath}`);
        return true;
      } else {
        console.warn(`⚠️  Локальный файл не найден: ${normalizedFullPath}`);
        return false;
      }
    } catch (err) {
      console.error(`❌ Ошибка удаления локального файла (${imageUrl}):`, err.message);
      return false;
    }
  }
}

/**
 * Удаляет массив изображений из хранилища (Cloudinary или локальное)
 * @param {string[]} imageUrls - Массив URL или путей к изображениям
 * @returns {Promise<number>} - Количество успешно удаленных изображений
 */
async function deleteImages(imageUrls) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
    console.log("ℹ️  Массив изображений пуст, удаление не требуется");
    return 0;
  }

  console.log(`🔄 Начинаем удаление ${imageUrls.length} изображений...`);
  let deletedCount = 0;
  
  for (const imageUrl of imageUrls) {
    try {
      const deleted = await deleteImage(imageUrl);
      if (deleted) {
        deletedCount++;
      }
    } catch (err) {
      console.error(`❌ Неожиданная ошибка при удалении ${imageUrl}:`, err.message);
    }
  }

  console.log(`✅ Удаление завершено: ${deletedCount} из ${imageUrls.length} изображений`);
  return deletedCount;
}

module.exports = {
  deleteImage,
  deleteImages,
  extractCloudinaryPublicId,
  normalizeImageUrl,
  hasCloudinary
};



