const FAQ_DOCS = {
  en: require("../locales/en/faq.json"),
  ru: require("../locales/ru/faq.json"),
  kk: require("../locales/kk/faq.json"),
  zh: require("../locales/zh/faq.json")
};

function getFaqDoc(locale) {
  const code = FAQ_DOCS[locale] ? locale : "en";
  return FAQ_DOCS[code];
}

function buildFaqJsonLd(faqDoc) {
  const mainEntity = [];
  for (const group of faqDoc.groups || []) {
    for (const item of group.items || []) {
      if (!item || !item.q || !item.a) continue;
      mainEntity.push({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a
        }
      });
    }
  }
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity
  });
}

module.exports = { FAQ_DOCS, getFaqDoc, buildFaqJsonLd };
