const translations = {
    "ru": {
        "title": "EXTO Ecosystem",
        "section1-title": "Введение",
        "section1-text": "Введение",
        "section2-title": "Токеномика",
        "section2-text": "Токеномика",
        "section3-title": "Дорожная карта",
        "section3-text": "Дорожная карта",
        "section4-title": "Белый лист",
        "section4-text": "Белый лист",
        "section5-title": "Колаборации",
        "section5-text": "Колаборации",
        "section6-title": "Реклама",
        "section6-text": "Реклама",
        "footer": "© 2024 EXTO Ecosystem"
    },
    "en": {
        "title": "EXTO Ecosystem",
        "section1-title": "Introduction",
        "section1-text": "Introduction",
        "section2-title": "Tokenomics",
        "section2-text": "Tokenomics",
        "section3-title": "Roadmap",
        "section3-text": "Roadmap",
        "section4-title": "White Paper",
        "section4-text": "White Paper",
        "section5-title": "Collaboration",
        "section5-text": "Collaboration",
        "section6-title": "Advertising",
        "section6-text": "Advertising",
        "footer": "© 2024 EXTO Ecosystem"
    },
    "zh": {
        "title": "EXTO 生态系统",
        "section1-title": "介绍",
        "section1-text": "介绍",
        "section2-title": "代币经济学",
        "section2-text": "代币经济学",
        "section3-title": "路线图",
        "section3-text": "路线图",
        "section4-title": "白皮书",
        "section4-text": "白皮书",
        "section5-title": "合作",
        "section5-text": "合作",
        "section6-title": "广告",
        "section6-text": "广告",
        "footer": "© 2024 EXTO 生态系统"
    }
};

function changeLanguage() {
    const lang = document.getElementById('language').value;

    if (!translations[lang]) {
        console.error(`Language ${lang} not found.`);
        return;
    }

    // Обновление языка в HTML
    document.documentElement.lang = lang;

    try {
        // Обновление текстов секций
        document.getElementById('title').innerText = translations[lang].title;
        document.getElementById('section1-title').innerText = translations[lang]['section1-title'];
        document.getElementById('section2-title').innerText = translations[lang]['section2-title'];
        document.getElementById('section3-title').innerText = translations[lang]['section3-title'];
        document.getElementById('section4-title').innerText = translations[lang]['section4-title'];
        document.getElementById('section5-title').innerText = translations[lang]['section5-title'];
        document.getElementById('section6-title').innerText = translations[lang]['section6-title'];

        // Обновление заголовков секций (section-header)
        document.getElementById('section1-header').innerText = translations[lang]['section1-title'];
        document.getElementById('section2-header').innerText = translations[lang]['section2-title'];
        document.getElementById('section3-header').innerText = translations[lang]['section3-title'];
        document.getElementById('section4-header').innerText = translations[lang]['section4-title'];
        document.getElementById('section5-header').innerText = translations[lang]['section5-title'];
        document.getElementById('section6-header').innerText = translations[lang]['section6-title'];

        // Обновление текста секций (section-text)
        document.getElementById('section1-text').innerText = translations[lang]['section1-text'];
        document.getElementById('section2-text').innerText = translations[lang]['section2-text'];
        document.getElementById('section3-text').innerText = translations[lang]['section3-text'];
        document.getElementById('section4-text').innerText = translations[lang]['section4-text'];
        document.getElementById('section5-text').innerText = translations[lang]['section5-text'];
        document.getElementById('section6-text').innerText = translations[lang]['section6-text'];

        // Обновление футера
        document.getElementById('footer').innerText = translations[lang].footer;
    } catch (e) {
        console.error('Ошибка при обновлении языка:', e);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    changeLanguage();
});
