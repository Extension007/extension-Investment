const path = require("path");
const i18next = require("i18next");
const Backend = require("i18next-fs-backend");
const middleware = require("i18next-http-middleware");

const SUPPORTED = ["en", "ru", "kk", "zh"];
const DEFAULT_LOCALE = "en";
const COOKIE_NAME = "locale";

const LANGUAGE_META = [
  { code: "en", label: "EN", name: "English" },
  { code: "ru", label: "RU", name: "Русский" },
  { code: "kk", label: "KZ", name: "Қазақша" },
  { code: "zh", label: "ZH", name: "中文" }
];

// Static requires so Vercel/NFT bundles locale JSON into the serverless function.
const resources = {
  en: {
    common: require("../locales/en/common.json"),
    categories: require("../locales/en/categories.json"),
    faq: require("../locales/en/faq.json")
  },
  ru: {
    common: require("../locales/ru/common.json"),
    categories: require("../locales/ru/categories.json"),
    faq: require("../locales/ru/faq.json")
  },
  kk: {
    common: require("../locales/kk/common.json"),
    categories: require("../locales/kk/categories.json"),
    faq: require("../locales/kk/faq.json")
  },
  zh: {
    common: require("../locales/zh/common.json"),
    categories: require("../locales/zh/categories.json"),
    faq: require("../locales/zh/faq.json")
  }
};

let ready = false;
let initPromise = null;

function initI18n() {
  if (ready) return Promise.resolve(i18next);
  if (initPromise) return initPromise;

  initPromise = i18next
    .use(Backend)
    .use(middleware.LanguageDetector)
    .init({
      resources,
      lng: DEFAULT_LOCALE,
      fallbackLng: DEFAULT_LOCALE,
      supportedLngs: SUPPORTED,
      preload: SUPPORTED,
      ns: ["common", "categories", "faq"],
      defaultNS: "common",
      // Keep fs-backend as a local-dev fallback; resources above win on Vercel.
      backend: {
        loadPath: path.join(__dirname, "../locales/{{lng}}/{{ns}}.json")
      },
      detection: {
        order: ["querystring", "cookie"],
        lookupQuerystring: "lang",
        lookupCookie: COOKIE_NAME,
        caches: false
      },
      interpolation: { escapeValue: false },
      initImmediate: false
    })
    .then(() => {
      ready = true;
      return i18next;
    })
    .catch((err) => {
      initPromise = null;
      throw err;
    });

  return initPromise;
}

function i18nMiddleware() {
  return middleware.handle(i18next, {
    ignoreRoutes: []
  });
}

function resolveRequestLocale(req) {
  const queryLang = String((req.query && (req.query.lang || req.query.lng)) || "").toLowerCase();
  if (SUPPORTED.includes(queryLang)) return queryLang;

  const cookieLang = String((req.cookies && req.cookies[COOKIE_NAME]) || "").toLowerCase();
  if (SUPPORTED.includes(cookieLang)) return cookieLang;

  return DEFAULT_LOCALE;
}

function attachLocals(req, res, next) {
  const lng = resolveRequestLocale(req);
  req.locale = lng;
  req.language = lng;
  req.lng = lng;
  if (req.i18n && typeof req.i18n.changeLanguage === "function") {
    req.i18n.changeLanguage(lng);
  }
  res.locals.locale = lng;
  res.locals.lang = lng;
  res.locals.languages = LANGUAGE_META;
  res.locals.t = (key, options) => req.t(key, options);
  const { formatLocation } = require("../data/locations");
  res.locals.formatLocation = (country, region, city) => formatLocation({ country, region, city }, lng);
  const commonBundle = i18next.getResourceBundle(lng, "common") || resources[lng]?.common || {};
  res.locals.i18nBundle = {
    locale: lng,
    js: commonBundle.js || {},
    common: commonBundle,
    categories: i18next.getResourceBundle(lng, "categories") || resources[lng]?.categories || {}
  };
  next();
}

function setLocaleCookie(res, locale) {
  res.cookie(COOKIE_NAME, locale, {
    maxAge: 365 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    path: "/",
    httpOnly: false
  });
}

module.exports = {
  SUPPORTED,
  DEFAULT_LOCALE,
  COOKIE_NAME,
  LANGUAGE_META,
  initI18n,
  i18nMiddleware,
  attachLocals,
  setLocaleCookie,
  resolveRequestLocale
};
