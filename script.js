const translations = {
    "ru": {
        "title": "EXTO Ecosystem",
        "section1-title": "Введение",
        "section2-title": "Токеномика",
        "section3-title": "Дорожная карта",
        "section4-title": "Белый лист",
        "section5-title": "Колабарация",
        "section6-title": "Реклама",
        "section1-header": "Введение",
        "section1-text": "Введение",
        "section2-header": "Токеномика",
        "section2-text": "Токеномика",
        "section3-header": "Дорожная карта",
        "section3-text": "Дорожная карта",
        "section4-header": "Белый лист",
        "section4-text": "Белый лист",
        "section5-header": "Колабарация",
        "section5-text": "Колабарация",
        "section6-header": "Реклама",
        "section6-text": "Реклама",
        "footer": "© 2024 EXTO Ecosystem"
    },
    "en": {
        "title": "EXTO Ecosystem",
        "section1-title": "Introduction",
        "section2-title": "Tokenomics",
        "section3-title": "Roadmap",
        "section4-title": "White Paper",
        "section5-title": "Collaboration",
        "section6-title": "Advertising",
        "section1-header": "Introduction",
        "section1-text": "Introduction",
        "section2-header": "Tokenomics",
        "section2-text": "Tokenomics",
        "section3-header": "Roadmap",
        "section3-text": "Roadmap",
        "section4-header": "White Paper",
        "section4-text": "White Paper",
        "section5-header": "Collaboration",
        "section5-text": "Collaboration",
        "section6-header": "Advertising",
        "section6-text": "Advertising",
        "footer": "© 2024 EXTO Ecosystem"
    },
    "zh": {
        "title": "EXTO 生态系统",
        "section1-title": "介绍",
        "section2-title": "代币经济学",
        "section3-title": "路线图",
        "section4-title": "白皮书",
        "section5-title": "合作",
        "section6-title": "广告",
        "section1-header": "介绍",
        "section1-text": "介绍",
        "section2-header": "代币经济学",
        "section2-text": "代币经济学",
        "section3-header": "路线图",
        "section3-text": "路线图",
        "section4-header": "白皮书",
        "section4-text": "白皮书",
        "section5-header": "合作",
        "section5-text": "合作",
        "section6-header": "广告",
        "section6-text": "广告",
        "footer": "© 2024 EXTO 生态系统"
    }
};

function changeLanguage() {
    const lang = document.getElementById('language').value;
    console.log('Selected language:', lang);  // Проверка, что язык выбран

    try {
        document.getElementById('title').innerText = translations[lang].title;
        document.getElementById('section1-title').innerText = translations[lang]['section1-title'];
        document.getElementById('section2-title').innerText = translations[lang]['section2-title'];
        document.getElementById('section3-title').innerText = translations[lang]['section3-title'];
        document.getElementById('section4-title').innerText = translations[lang]['section4-title'];
        document.getElementById('section5-title').innerText = translations[lang]['section5-title'];
        document.getElementById('section6-title').innerText = translations[lang]['section6-title'];

        document.getElementById('section1-header').innerText = translations[lang]['section1-header'];
        document.getElementById('section1-text').innerText = translations[lang]['section1-text'];
        document.getElementById('section2-header').innerText = translations[lang]['section2-header'];
        document.getElementById('section2-text').innerText = translations[lang]['section2-text'];
        document.getElementById('section3-header').innerText = translations[lang]['section3-header'];
        document.getElementById('section3-text').innerText = translations[lang]['section3-text'];
        document.getElementById('section4-header').innerText = translations[lang]['section4-header'];
        document.getElementById('section4-text').innerText = translations[lang]['section4-text'];
        document.getElementById('section5-header').innerText = translations[lang]['section5-header'];
        document.getElementById('section5-text').innerText = translations[lang]['section5-text'];
        document.getElementById('section6-header').innerText = translations[lang]['section6-header'];
        document.getElementById('section6-text').innerText = translations[lang]['section6-text'];

        document.getElementById('footer').innerText = translations[lang].footer;

        console.log('Content updated for language:', lang);  // Проверка успешного обновления контента
    } catch (e) {
        console.error('Error updating language:', e);
    }
}
