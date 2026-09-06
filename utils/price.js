/**
 * Free-form price for product/service cards (text and/or digits).
 */

const { DEFAULT_CURRENCY, currencySymbol, normalizeCurrency } = require("./currency");

function normalizePrice(value) {
  if (value == null) {
    throw new Error("Цена обязательна");
  }
  const raw = String(value).trim().replace(/\s+/g, " ");
  if (!raw) {
    throw new Error("Цена обязательна");
  }
  if (raw.length > 80) {
    throw new Error("Цена слишком длинная");
  }
  return raw;
}

/** Display as stored; append currency symbol only for plain numeric values */
function formatPriceDisplay(value, currency = DEFAULT_CURRENCY) {
  const raw = value == null ? "" : String(value).trim();
  if (!raw) return "";
  let code = DEFAULT_CURRENCY;
  try {
    code = normalizeCurrency(currency);
  } catch (_) {
    code = DEFAULT_CURRENCY;
  }
  const symbol = currencySymbol(code);
  if (/^\d+([.,]\d+)?$/.test(raw.replace(/\s/g, ""))) {
    return `${raw.replace(/\s/g, "").replace(",", ".")} ${symbol}`;
  }
  return `${raw} ${symbol}`;
}

module.exports = {
  normalizePrice,
  formatPriceDisplay
};
