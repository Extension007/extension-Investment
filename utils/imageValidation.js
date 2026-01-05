// FIX: Унифицированная валидация изображений
// Стандартизирует проверку лимитов и дубликатов изображений

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * Валидирует массив загруженных файлов
 * @param {Array} files - Массив файлов
 * @returns {Object} Результат валидации
 */
function validateImageFiles(files) {
  const result = {
    valid: true,
    errors: [],
    warnings: [],
    images: []
  };

  if (!files || files.length === 0) {
    return result;
  }

  // Проверяем общее количество файлов
  if (files.length > MAX_IMAGES) {
    result.valid = false;
    result.errors.push(`Максимальное количество изображений: ${MAX_IMAGES}`);
    return result;
  }

  files.forEach((file, index) => {
    try {
      // Проверяем наличие файла
      if (!file || !file.filename) {
        result.errors.push(`Файл ${index + 1} отсутствует или поврежден`);
        return;
      }

      // Проверяем размер файла
      if (file.size > MAX_FILE_SIZE) {
        result.errors.push(`Файл "${file.filename}" превышает размер ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        return;
      }

      // Проверяем тип файла
      if (!ALLOWED_TYPES.includes(file.mimetype)) {
        result.errors.push(`Файл "${file.filename}" имеет неподдерживаемый формат. Допустимые: ${ALLOWED_TYPES.join(', ')}`);
        return;
      }

      // Формируем путь к изображению
      let imagePath;
      if (file.path && !file.path.startsWith('http')) {
        // Локальное хранилище
        imagePath = '/uploads/' + file.filename;
      } else if (file.path) {
        // Cloudinary или другой внешний сервис
        imagePath = file.path;
      } else {
        result.errors.push(`Файл "${file.filename}" не имеет валидного пути`);
        return;
      }

      result.images.push({
        path: imagePath,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        originalName: file.originalname || file.filename
      });

    } catch (error) {
      result.errors.push(`Ошибка обработки файла ${index + 1}: ${error.message}`);
    }
  });

  if (result.errors.length > 0) {
    result.valid = false;
  }

  return result;
}

/**
 * Проверяет дубликаты изображений
 * @param {Array} images - Массив путей к изображениям
 * @returns {Object} Результат проверки дубликатов
 */
function checkDuplicateImages(images) {
  const result = {
    hasDuplicates: false,
    duplicates: [],
    uniqueImages: []
  };

  if (!images || images.length === 0) {
    return result;
  }

  const seen = new Map();

  images.forEach((image, index) => {
    const key = String(image).trim().toLowerCase();
    
    if (seen.has(key)) {
      result.hasDuplicates = true;
      result.duplicates.push({
        value: image,
        indices: [seen.get(key), index]
      });
    } else {
      seen.set(key, index);
      result.uniqueImages.push(image);
    }
  });

  return result;
}

/**
 * Объединяет существующие и новые изображения с проверкой лимитов
 * @param {Array} existingImages - Существующие изображения
 * @param {Array} newImages - Новые изображения
 * @returns {Object} Результат объединения
 */
function combineImages(existingImages, newImages) {
  const result = {
    valid: true,
    errors: [],
    images: [],
    toDelete: []
  };

  // Начинаем с существующих изображений
  let combinedImages = [...(existingImages || [])];

  // Добавляем новые изображения
  if (newImages && newImages.length > 0) {
    combinedImages = [...combinedImages, ...newImages];
  }

  // Проверяем общий лимит
  if (combinedImages.length > MAX_IMAGES) {
    result.valid = false;
    result.errors.push(`Максимальное количество изображений: ${MAX_IMAGES}. Текущее количество: ${combinedImages.length}`);
    return result;
  }

  // Проверяем дубликаты
  const duplicateCheck = checkDuplicateImages(combinedImages);
  
  if (duplicateCheck.hasDuplicates) {
    result.valid = false;
    result.errors.push('Обнаружены дублирующиеся изображения');
    duplicateCheck.duplicates.forEach(dup => {
      result.errors.push(`Дубликат: "${dup.value}" (индексы: ${dup.indices.join(', ')})`);
    });
  }

  result.images = duplicateCheck.uniqueImages;
  result.duplicates = duplicateCheck.duplicates;

  return result;
}

/**
 * Находит изображения для удаления при обновлении
 * @param {Array} oldImages - Старые изображения
 * @param {Array} newImages - Новые изображения
 * @returns {Array} Массив изображений для удаления
 */
function findImagesToDelete(oldImages, newImages) {
  if (!oldImages || oldImages.length === 0) {
    return [];
  }

  if (!newImages || newImages.length === 0) {
    return [...oldImages];
  }

  return oldImages.filter(oldImg => {
    const existsInNew = newImages.some(newImg => 
      String(oldImg).trim() === String(newImg).trim()
    );
    return !existsInNew;
  });
}

/**
 * Создает предпросмотр изображений для интерфейса
 * @param {Array} images - Массив путей к изображениям
 * @returns {Array} Массив для предпросмотра
 */
function createImagePreview(images) {
  if (!images || images.length === 0) {
    return [];
  }

  return images.map((image, index) => ({
    url: String(image),
    alt: `Изображение ${index + 1}`,
    index: index
  }));
}

module.exports = {
  MAX_IMAGES,
  MAX_FILE_SIZE,
  ALLOWED_TYPES,
  validateImageFiles,
  checkDuplicateImages,
  combineImages,
  findImagesToDelete,
  createImagePreview
};
