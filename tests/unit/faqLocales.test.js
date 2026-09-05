const { getFaqDoc, buildFaqJsonLd } = require("../../utils/faqDoc");

describe("faq locales", () => {
  const langs = ["en", "ru", "kk", "zh"];
  const expectedIds = ["about", "account", "catalog", "publish", "alba", "referral", "chat", "rules", "support"];

  test("all languages share the same section structure", () => {
    const counts = langs.map((lang) => {
      const doc = getFaqDoc(lang);
      expect(doc.title).toBeTruthy();
      expect(Array.isArray(doc.groups)).toBe(true);
      expect(doc.groups.map((g) => g.id)).toEqual(expectedIds);
      return doc.groups.map((g) => (g.items || []).length);
    });
    counts.forEach((row) => {
      expect(row).toEqual(counts[0]);
      expect(row.reduce((sum, n) => sum + n, 0)).toBeGreaterThanOrEqual(30);
    });
  });

  test("every question has an answer", () => {
    langs.forEach((lang) => {
      getFaqDoc(lang).groups.forEach((group) => {
        group.items.forEach((item) => {
          expect(String(item.q || "").trim().length).toBeGreaterThan(3);
          expect(String(item.a || "").trim().length).toBeGreaterThan(20);
        });
      });
    });
  });

  test("json-ld lists all questions", () => {
    const doc = getFaqDoc("ru");
    const ld = JSON.parse(buildFaqJsonLd(doc));
    expect(ld["@type"]).toBe("FAQPage");
    const count = doc.groups.reduce((sum, g) => sum + g.items.length, 0);
    expect(ld.mainEntity).toHaveLength(count);
  });
});
