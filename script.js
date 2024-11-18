const roadmapData = {
    "ru": [
        "1. Формирование идеи проекта — Определение основной концепции и целей.",
        "2. Разработка веб-приложения — Создание первого прототипа и базового функционала.",
        "3. Выпуск токена — Запуск собственной криптовалюты для экосистемы.",
        "4. Создание социальных сетей — Открытие официальных аккаунтов для взаимодействия с аудиторией.",
        "5. Pre-sale — Продажа токенов на ранней стадии для привлечения инвестиций.",
        "6. Запуск пула — Создание пула ликвидности для обмена и хранения токенов.",
        "7. Запуск приложения для набора поинтов — Внедрение системы начисления поинтов для сжигания токенов.",
        "8. Запуск LaunchPad — предоставление инвесторам войти в проект на ранней стадии.",
        "9. Масштабирование проекта — Расширение инфраструктуры и повышение нагрузки.",
        "10. Запуск первого раунда сжигания — Начало процесса сжигания токенов для контроля их эмиссии."
    ],
    "en": [
        "1. Project Idea Formation — Defining the main concept and goals.",
        "2. Web Application Development — Creating the first prototype and basic functionality.",
        "3. Token Launch — Launching a native cryptocurrency for the ecosystem.",
        "4. Creating Social Networks — Establishing official accounts for audience interaction.",
        "5. Pre-sale — Selling tokens at an early stage to attract investments.",
        "6. Pool Launch — Establishing a liquidity pool for token exchange and storage.",
        "7. Launching Points App — Implementing a system for points and token burning.",
        "8. LaunchPad Launch — Allowing investors to join the project early.",
        "9. Project Scaling — Expanding infrastructure and improving capacity.",
        "10. First Burn Round — Starting token burning to manage supply."
    ],
    "zh": [
        "1. 项目理念形成 — 确定主要概念和目标。",
        "2. 开发 Web 应用程序 — 创建第一个原型和基本功能。",
        "3. 代币发行 — 为生态系统启动自己的加密货币。",
        "4. 创建社交网络 — 开设官方账户与受众互动。",
        "5. 预售 — 在早期阶段销售代币以吸引投资。",
        "6. 启动流动池 — 为代币交换和存储创建流动性池。",
        "7. 启动积分应用 — 实施积分系统和代币燃烧机制。",
        "8. LaunchPad 启动 — 允许投资者早期加入项目。",
        "9. 项目扩展 — 扩展基础设施并提高容量。",
        "10. 第一次燃烧回合 — 开始代币燃烧以管理供应。"
    ]
};

function updateRoadmap(lang) {
    const roadmapElement = document.getElementById('roadmap-text');
    roadmapElement.innerHTML = "";
    roadmapData[lang].forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        roadmapElement.appendChild(li);
    });
}

const translations = {
    "ru": {
        "title": "EXTO Ecosystem",
        "section1-title": "Введение",
        "section2-title": "Токеномика",
        "section3-title": "Дорожная карта",
        "section4-title": "Белый лист",
        "section5-title": "Колабарация",
        "section6-title": "Реклама",
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
        "footer": "© 2024 EXTO 生态系统"
    }
};

function changeLanguage() {
    const lang = document.getElementById('language').value;

    try {
        // Обновление текстов секций
        document.getElementById('title').innerText = translations[lang].title;
        document.getElementById('section1-title').innerText = translations[lang]['section1-title'];
        document.getElementById('section2-title').innerText = translations[lang]['section2-title'];
        document.getElementById('section3-title').innerText = translations[lang]['section3-title'];
        document.getElementById('section4-title').innerText = translations[lang]['section4-title'];
        document.getElementById('section5-title').innerText = translations[lang]['section5-title'];
        document.getElementById('section6-title').innerText = translations[lang]['section6-title'];

        // Обновление дорожной карты
        updateRoadmap(lang);

        // Обновление футера
        document.getElementById('footer').innerText = translations[lang].footer;

    } catch (e) {
        console.error('Error updating language:', e);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    changeLanguage();
});
