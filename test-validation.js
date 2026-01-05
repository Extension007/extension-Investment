// Тестирование валидаторов
const { validatePhone, validateEmail } = require('./middleware/validators');

// Тест 1: Проверка валидации пустого значения
console.log('Тест 1: Проверка валидации пустого значения');
const emptyPhone = '';
const emptyEmail = '';
const emptyTelegram = '';
const emptyWhatsapp = '';

console.log('Телефон (пустой):', validatePhone(emptyPhone));
console.log('Email (пустой):', validateEmail(emptyEmail));
console.log('Телеграм (пустой):', /^@?[a-zA-Z0-9_]{5,100}$/.test(emptyTelegram));
console.log('WhatsApp (пустой):', validatePhone(emptyWhatsapp));

// Тест 2: Проверка валидации корректных значений
console.log('\nТест 2: Проверка валидации корректных значений');
const validPhone = '+79991234567';
const validEmail = 'test@example.com';
const validTelegram = '@username';
const validWhatsapp = '+79991234567';

console.log('Телефон (корректный):', validatePhone(validPhone));
console.log('Email (корректный):', validateEmail(validEmail));
console.log('Телеграм (корректный):', /^@?[a-zA-Z0-9_]{5,100}$/.test(validTelegram));
console.log('WhatsApp (корректный):', validatePhone(validWhatsapp));

// Тест 3: Проверка валидации некорректных значений
console.log('\nТест 3: Проверка валидации некорректных значений');
const invalidPhone = '123';
const invalidEmail = 'invalid-email';
const invalidTelegram = '@ab'; // Слишком короткий
const invalidWhatsapp = '123';

console.log('Телефон (некорректный):', validatePhone(invalidPhone));
console.log('Email (некорректный):', validateEmail(invalidEmail));
console.log('Телеграм (некорректный):', /^@?[a-zA-Z0-9_]{5,100}$/.test(invalidTelegram));
console.log('WhatsApp (некорректный):', validatePhone(invalidWhatsapp));

console.log('\nТестирование завершено.');