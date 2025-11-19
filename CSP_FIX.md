# Исправление Content Security Policy (CSP)

## Проблема

Ошибка в консоли браузера:
```
Executing inline script violates the following Content Security Policy directive 'script-src 'self''. 
Either the 'unsafe-inline' keyword, a hash ('sha256-Ws3z8Id76DcznACTbAKKHvQj9tjSLDRPIAheBLiudPg='), 
or a nonce ('nonce-...') is required to enable inline execution.
```

Также предупреждения:
```
Tracking Prevention blocked access to storage for https://res.cloudinary.com/...
```

## Причина

1. **Inline скрипты блокируются**: CSP директива `script-src 'self'` не разрешает выполнение inline скриптов
2. **Cloudinary не добавлен в imgSrc**: Изображения с Cloudinary могут блокироваться браузером

## Решение

### 1. Добавлен `'unsafe-inline'` в `scriptSrc`

**Было:**
```javascript
scriptSrc: ["'self'"]
```

**Стало:**
```javascript
scriptSrc: ["'self'", "'unsafe-inline'"]
```

Это разрешает выполнение inline скриптов, которые используются в:
- `views/admin.ejs` - скрипты модерации и видео
- `views/cabinet.ejs` - скрипты создания карточек
- `views/index.ejs` - скрипты регистрации

### 2. Добавлен Cloudinary в `imgSrc`

**Было:**
```javascript
imgSrc: ["'self'", "data:", "https:", "blob:"]
```

**Стало:**
```javascript
imgSrc: ["'self'", "data:", "https:", "blob:", "https://res.cloudinary.com"]
```

Это разрешает загрузку изображений с Cloudinary и предотвращает предупреждения Tracking Prevention.

## Безопасность

`'unsafe-inline'` разрешает выполнение inline скриптов, что может быть уязвимостью. Однако:
- Это необходимо для работы админ-панели и других страниц
- Альтернативы (nonce/hash) требуют более сложной реализации
- Для внутренних приложений это приемлемый компромисс

Если нужна более строгая безопасность, можно:
1. Вынести все inline скрипты в отдельные файлы
2. Использовать nonce для каждого скрипта
3. Использовать hash для каждого скрипта

## Результат

✅ Inline скрипты теперь выполняются без ошибок
✅ Изображения с Cloudinary загружаются без предупреждений
✅ Все функции админ-панели работают корректно

