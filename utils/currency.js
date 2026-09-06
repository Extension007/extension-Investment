/** Supported listing currencies (ISO-like codes). */

const CURRENCIES = [
  { code: "KZT", symbol: "₸" },
  { code: "USD", symbol: "$" },
  { code: "EUR", symbol: "€" },
  { code: "RUB", symbol: "₽" },
  { code: "CNY", symbol: "¥" },
  { code: "KGS", symbol: "сом" },
  { code: "UZS", symbol: "сум" }
];

const CURRENCY_CODES = CURRENCIES.map((c) => c.code);
const DEFAULT_CURRENCY = "KZT";

function normalizeCurrency(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  if (!code) return DEFAULT_CURRENCY;
  if (!CURRENCY_CODES.includes(code)) {
    const err = new Error("Некорректная валюта");
    err.status = 400;
    throw err;
  }
  return code;
}

function currencySymbol(code) {
  const found = CURRENCIES.find((c) => c.code === normalizeCurrency(code || DEFAULT_CURRENCY));
  return found ? found.symbol : "₸";
}

function currencyMeta(code) {
  const normalized = normalizeCurrency(code || DEFAULT_CURRENCY);
  return CURRENCIES.find((c) => c.code === normalized) || CURRENCIES[0];
}

module.exports = {
  CURRENCIES,
  CURRENCY_CODES,
  DEFAULT_CURRENCY,
  normalizeCurrency,
  currencySymbol,
  currencyMeta
};
