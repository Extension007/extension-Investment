const translations = {
    "ru": {
        "title": "EXTO Ecosystem",
        "section1-title": "Раздел 1",
        "section2-title": "Раздел 2",
        "section3-title": "Раздел 3",
        "section4-title": "Раздел 4",
        "section5-title": "Раздел 5",
        "section6-title": "Раздел 6",
        "section1-header": "Раздел 1",
        "section1-text": "Контент для раздела 1",
        "section2-header": "Раздел 2",
        "section2-text": "Контент для раздела 2",
        "section3-header": "Раздел 3",
        "section3-text": "Контент для раздела 3",
        "section4-header": "Раздел 4",
        "section4-text": "Контент для раздела 4",
        "section5-header": "Раздел 5",
        "section5-text": "Контент для раздела 5",
        "section6-header": "Раздел 6",
        "section6-text": "Контент для раздела 6",
        "footer": "© 2024 EXTO Ecosystem"
    },
    "en": {
        "title": "EXTO Ecosystem",
        "section1-title": "Section 1",
        "section2-title": "Section 2",
        "section3-title": "Section 3",
        "section4-title": "Section 4",
        "section5-title": "Section 5",
        "section6-title": "Section 6",
        "section1-header": "Section 1",
        "section1-text": "Content for Section 1",
        "section2-header": "Section 2",
        "section2-text": "Content for Section 2",
        "section3-header": "Section 3",
        "section3-text": "Content for Section 3",
        "section4-header": "Section 4",
        "section4-text": "Content for Section 4",
        "section5-header": "Section 5",
        "section5-text": "Content for Section 5",
        "section6-header": "Section 6",
        "section6-text": "Content for Section 6",
        "footer": "© 2024 EXTO Ecosystem"
    },
    "zh": {
        "title": "EXTO 生态系统",
        "section1-title": "第一部分",
        "section2-title": "第二部分",
        "section3-title": "第三部分",
        "section4-title": "第四部分",
        "section5-title": "第五部分",
        "section6-title": "第六部分",
        "section1-header": "第一部分",
        "section1-text": "第一部分的内容",
        "section2-header": "第二部分",
        "section2-text": "第二部分的内容",
        "section3-header": "第三部分",
        "section3-text": "第三部分的内容",
        "section4-header": "第四部分",
        "section4-text": "第四部分的内容",
        "section5-header": "第五部分",
        "section5-text": "第五部分的内容",
        "section6-header": "第六部分",
        "section6-text": "第六部分的内容",
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
