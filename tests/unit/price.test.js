const { normalizePrice, formatPriceDisplay } = require('../../utils/price');
const { normalizeCurrency } = require('../../utils/currency');
const { pickFields, sanitizeStoredTranslations, applyCardLocale } = require('../../services/cardTranslationService');

describe('price helpers', () => {
  test('keeps free text as-is', () => {
    expect(normalizePrice('от 1000')).toBe('от 1000');
    expect(normalizePrice('договорная')).toBe('договорная');
    expect(normalizePrice('15000 тг')).toBe('15000 тг');
  });

  test('trims whitespace', () => {
    expect(normalizePrice('  12000  ')).toBe('12000');
  });

  test('rejects empty', () => {
    expect(() => normalizePrice('')).toThrow(/обязательна/i);
    expect(() => normalizePrice('   ')).toThrow(/обязательна/i);
  });

  test('formatPriceDisplay adds selected currency symbol', () => {
    expect(formatPriceDisplay('1000', 'KZT')).toBe('1000 ₸');
    expect(formatPriceDisplay('1000', 'USD')).toBe('1000 $');
    expect(formatPriceDisplay('от 1000', 'EUR')).toBe('от 1000 €');
  });
});

describe('currency helpers', () => {
  test('normalizes currency codes', () => {
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(normalizeCurrency('')).toBe('KZT');
    expect(() => normalizeCurrency('BTC')).toThrow(/валют/i);
  });
});

describe('card translations storage', () => {
  test('sanitize keeps source fields', () => {
    const out = sanitizeStoredTranslations(
      { ru: { name: 'Тест', description: 'Опис', price: '100', tags: ['a'], contact_method: 'звонок' } },
      'ru',
      { name: 'Fallback', description: '', price: '1', tags: [], contact_method: '' }
    );
    expect(out.ru.name).toBe('Тест');
    expect(out.ru.tags).toEqual(['a']);
  });

  test('applyCardLocale uses translation block', () => {
    const card = applyCardLocale(
      {
        name: 'Hello',
        description: 'Desc',
        price: '10',
        currency: 'USD',
        tags: ['sale'],
        contacts: { contact_method: 'call' },
        translations: {
          ru: {
            name: 'Привет',
            description: 'Описание',
            price: '10',
            tags: ['скидка'],
            contact_method: 'звонок'
          }
        }
      },
      'ru'
    );
    expect(card.name).toBe('Привет');
    expect(card.contacts.contact_method).toBe('звонок');
    expect(card.currency).toBe('USD');
  });

  test('pickFields normalizes tags', () => {
    expect(pickFields({ name: 'A', tags: ['#x', 'y'] }).tags).toEqual(['#x', 'y']);
  });
});
