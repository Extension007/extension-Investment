# Исправление проблемы с Cloudinary

## Проблема
При создании карточки товара возникала ошибка: `Global error: Must supply api_key`

## Причина
Cloudinary требует настройки API ключей в переменных окружения, но они не были настроены.

## Решение
Добавлена поддержка локального хранилища файлов как fallback, если Cloudinary не настроен.

### Изменения в `utils/upload.js`:
- Проверка наличия переменных окружения Cloudinary
- Если Cloudinary настроен → используется Cloudinary
- Если Cloudinary не настроен → используется локальное хранилище в папке `uploads/`

### Изменения в `server.js`:
- Обработка путей к изображениям для обоих случаев:
  - Cloudinary: используется полный URL из `req.file.path`
  - Локальное хранилище: используется относительный путь `/uploads/filename`

## Использование

### Без Cloudinary (локальное хранилище):
Просто не указывайте переменные окружения Cloudinary. Файлы будут сохраняться в папку `uploads/`.

### С Cloudinary:
Добавьте в `.env`:
```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Примечания
- Папка `uploads/` автоматически создается при первом использовании
- Папка `uploads/` добавлена в `.gitignore`
- Максимальный размер файла: 5MB

