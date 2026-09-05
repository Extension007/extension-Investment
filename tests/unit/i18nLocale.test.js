const { resolveRequestLocale, DEFAULT_LOCALE } = require("../../middleware/i18n");

describe("resolveRequestLocale", () => {
  test("defaults to English without cookie or query", () => {
    expect(resolveRequestLocale({ query: {}, cookies: {} })).toBe("en");
    expect(resolveRequestLocale({ query: {}, cookies: {} })).toBe(DEFAULT_LOCALE);
  });

  test("ignores Accept-Language style values on the request object", () => {
    expect(resolveRequestLocale({
      query: {},
      cookies: {},
      language: "ru",
      headers: { "accept-language": "ru-RU,ru;q=0.9" }
    })).toBe("en");
  });

  test("honors explicit cookie and query", () => {
    expect(resolveRequestLocale({ query: {}, cookies: { locale: "ru" } })).toBe("ru");
    expect(resolveRequestLocale({ query: { lang: "kk" }, cookies: { locale: "ru" } })).toBe("kk");
    expect(resolveRequestLocale({ query: { lang: "xx" }, cookies: {} })).toBe("en");
  });
});
