const { CURRENCIES, DEFAULT_CURRENCY, normalizeCurrency } = require("../utils/currency");

const SUPPORTED_LOCALES = ["en", "ru", "kk", "zh"];

/** Map app locale → MyMemory / common API language code */
const API_LANG = {
  en: "en",
  ru: "ru",
  kk: "kk",
  zh: "zh-CN"
};

function isPlainNumberPrice(value) {
  return /^\d+([.,]\d+)?$/.test(String(value || "").trim().replace(/\s/g, ""));
}

function normalizeTagsInput(tags) {
  if (Array.isArray(tags)) {
    return tags.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 15);
  }
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return normalizeTagsInput(parsed);
    } catch (_) {
      /* ignore */
    }
    return tags
      .split(/[,#\n]/)
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 15);
  }
  return [];
}

function pickFields(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    description: String(payload.description || "").trim(),
    price: String(payload.price || "").trim(),
    tags: normalizeTagsInput(payload.tags),
    contact_method: String(payload.contact_method || "").trim()
  };
}

async function translateViaMyMemory(text, from, to) {
  const q = String(text || "").trim();
  if (!q) return "";
  if (from === to) return q;
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(q.slice(0, 450)) +
    "&langpair=" +
    encodeURIComponent(`${from}|${to}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`translate_http_${res.status}`);
    const data = await res.json();
    const out = data && data.responseData && data.responseData.translatedText;
    if (!out || String(out).trim() === "") return q;
    // MyMemory often returns QUOTA EXCEEDED as the "translation"
    if (/QUERY LENGTH LIMIT|QUOTA|INVALID/i.test(String(out))) return q;
    return String(out).trim();
  } finally {
    clearTimeout(timer);
  }
}

async function translateViaGoogle(text, from, to, apiKey) {
  const q = String(text || "").trim();
  if (!q) return "";
  if (from === to) return q;
  const endpoint =
    "https://translation.googleapis.com/language/translate/v2?key=" +
    encodeURIComponent(apiKey);
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q,
      source: from === "zh-CN" ? "zh-CN" : from,
      target: to === "zh-CN" ? "zh-CN" : to,
      format: "text"
    })
  });
  if (!res.ok) throw new Error(`google_translate_${res.status}`);
  const data = await res.json();
  const out =
    data &&
    data.data &&
    data.data.translations &&
    data.data.translations[0] &&
    data.data.translations[0].translatedText;
  return out ? String(out).trim() : q;
}

async function translateText(text, fromLocale, toLocale) {
  const q = String(text || "").trim();
  if (!q) return "";
  if (fromLocale === toLocale) return q;
  if (isPlainNumberPrice(q)) return q;

  const from = API_LANG[fromLocale] || fromLocale;
  const to = API_LANG[toLocale] || toLocale;
  const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY || process.env.TRANSLATE_API_KEY;

  try {
    if (googleKey) {
      return await translateViaGoogle(q, from, to, googleKey);
    }
    return await translateViaMyMemory(q, from, to);
  } catch (err) {
    console.warn("card_translate_fallback", err.message);
    return q;
  }
}

async function translateFieldSet(fields, fromLocale, toLocale) {
  if (fromLocale === toLocale) {
    return { ...fields, tags: [...(fields.tags || [])] };
  }
  const [name, description, price, contact_method, ...tagParts] = await Promise.all([
    translateText(fields.name, fromLocale, toLocale),
    translateText(fields.description, fromLocale, toLocale),
    translateText(fields.price, fromLocale, toLocale),
    translateText(fields.contact_method, fromLocale, toLocale),
    ...fields.tags.map((tag) => translateText(tag, fromLocale, toLocale))
  ]);
  return {
    name,
    description,
    price,
    contact_method,
    tags: tagParts
  };
}

/**
 * Build translations for all supported locales.
 * Source locale keeps original text.
 */
async function buildCardTranslations(payload, sourceLocaleInput) {
  const sourceLocale = SUPPORTED_LOCALES.includes(sourceLocaleInput)
    ? sourceLocaleInput
    : "en";
  const fields = pickFields(payload);
  const translations = {};
  translations[sourceLocale] = { ...fields, tags: [...fields.tags] };

  const targets = SUPPORTED_LOCALES.filter((l) => l !== sourceLocale);
  // Sequential targets to reduce free-API rate limits; fields inside are parallel.
  for (const locale of targets) {
    translations[locale] = await translateFieldSet(fields, sourceLocale, locale);
  }

  return {
    sourceLocale,
    translations,
    provider: process.env.GOOGLE_TRANSLATE_API_KEY || process.env.TRANSLATE_API_KEY ? "google" : "mymemory"
  };
}

function sanitizeStoredTranslations(raw, sourceLocale, fallbackFields) {
  const base = pickFields(fallbackFields);
  const out = {};
  const incoming = raw && typeof raw === "object" ? raw : {};
  for (const locale of SUPPORTED_LOCALES) {
    const block = incoming[locale] && typeof incoming[locale] === "object" ? incoming[locale] : null;
    if (block) {
      out[locale] = pickFields(block);
    } else if (locale === sourceLocale) {
      out[locale] = { ...base, tags: [...base.tags] };
    }
  }
  if (!out[sourceLocale]) {
    out[sourceLocale] = { ...base, tags: [...base.tags] };
  }
  return out;
}

function applyCardLocale(card, locale) {
  if (!card) return card;
  const plain =
    typeof card.toJSON === "function"
      ? card.toJSON()
      : { ...(card.dataValues || card) };
  const code = SUPPORTED_LOCALES.includes(locale) ? locale : "en";
  const tr =
    plain.translations && typeof plain.translations === "object"
      ? plain.translations[code]
      : null;
  if (!tr) {
    return {
      ...plain,
      currency: plain.currency || DEFAULT_CURRENCY
    };
  }
  const contacts = { ...(plain.contacts || {}) };
  if (tr.contact_method != null && String(tr.contact_method).trim() !== "") {
    contacts.contact_method = tr.contact_method;
  }
  return {
    ...plain,
    name: tr.name || plain.name,
    description: tr.description != null ? tr.description : plain.description,
    price: tr.price != null && String(tr.price).trim() !== "" ? tr.price : plain.price,
    tags: Array.isArray(tr.tags) && tr.tags.length ? tr.tags : plain.tags,
    contacts,
    currency: plain.currency || DEFAULT_CURRENCY
  };
}

function localizeCardList(cards, locale) {
  if (!Array.isArray(cards)) return [];
  return cards.map((c) => applyCardLocale(c, locale));
}

module.exports = {
  SUPPORTED_LOCALES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  normalizeCurrency,
  pickFields,
  buildCardTranslations,
  sanitizeStoredTranslations,
  applyCardLocale,
  localizeCardList,
  isPlainNumberPrice
};
