const langs = ["en", "ru", "kk", "zh"];

function collectKeys(value, prefix = "") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  return Object.keys(value)
    .sort()
    .flatMap((key) => collectKeys(value[key], prefix ? `${prefix}.${key}` : key));
}

describe("common locale key parity", () => {
  const bundles = Object.fromEntries(
    langs.map((lang) => [lang, require(`../../locales/${lang}/common.json`)])
  );
  const enKeys = collectKeys(bundles.en);

  test("ru/kk/zh share the English common.json key tree", () => {
    langs.filter((lang) => lang !== "en").forEach((lang) => {
      expect(collectKeys(bundles[lang])).toEqual(enKeys);
    });
  });

  test("auto-renew cabinet and js strings exist in every language", () => {
    langs.forEach((lang) => {
      expect(bundles[lang].cabinet.autoRenewOff).toBeTruthy();
      expect(bundles[lang].cabinet.autoRenewOn).toBeTruthy();
      expect(bundles[lang].cabinet.autoRenewHint).toBeTruthy();
      expect(bundles[lang].js.autoRenewConfirm).toBeTruthy();
      expect(bundles[lang].js.autoRenewFail).toBeTruthy();
    });
  });
});
