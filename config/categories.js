// Иерархическое дерево категорий Albamount (2026) - БЕЗ ИКОНОК
const HIERARCHICAL_CATEGORIES = {
  "home": {
    label: "Недвижимость и дом",
    children: {
      "apartments": { label: "Квартиры", children: {
          "sale": { label: "Продажа" },
          "rent": { label: "Аренда" },
          "new_buildings": { label: "Новостройки" }
        }
      },
      "houses": { label: "Дома и коттеджи" },
      "commercial": { label: "Коммерческая недвижимость" },
      "land": { label: "Земельные участки" },
      "renovation": { label: "Ремонт и дизайн интерьера" },
      "smart_home": { label: "Умный дом и автоматизация" },
      "garden": { label: "Сад и огород" },
      "furniture": { label: "Мебель и интерьер" }
    }
  },
  "auto": {
    label: "Автомобили и транспорт",
    children: {
      "cars": { label: "Автомобили", children: {
          "new": { label: "Новые" },
          "used": { label: "Б/у" },
          "electric": { label: "Электромобили и зарядные станции" }
        }
      },
      "motorcycles": { label: "Мотоциклы и скутеры" },
      "bicycles": { label: "Велосипеды и электросамокаты" },
      "parts": { label: "Запчасти и аксессуары" },
      "electronics": { label: "Автоэлектроника", children: {
          "navigators": { label: "Навигаторы" },
          "recorders": { label: "Видеорегистраторы" },
          "multimedia": { label: "Мультимедиа" }
        }
      },
      "service": { label: "Сервис и ремонт" },
      "carsharing": { label: "Аренда и каршеринг" },
      "tuning": { label: "Тюнинг и кастомизация" }
    }
  },
  "electronics": {
    label: "Электроника и техника",
    children: {
      "phones": { label: "Смартфоны и аксессуары" },
      "computers": { label: "Компьютеры и периферия" },
      "appliances": { label: "Бытовая техника", children: {
          "large": { label: "Крупная" },
          "small": { label: "Мелкая" }
        }
      },
      "audio_video": { label: "Аудио и видео техника" },
      "gaming": { label: "Игровая электроника", children: {
          "consoles": { label: "Консоли" },
          "vr_ar": { label: "VR/AR устройства" },
          "gaming_peripherals": { label: "Геймерская периферия" }
        }
      },
      "robotics": { label: "Робототехника и автоматизация быта" },
      "drones": { label: "Дроны и квадрокоптеры" }
    }
  },
  "beauty": {
    label: "Красота и здоровье",
    children: {
      "cosmetics": { label: "Косметика и уход" },
      "medical": { label: "Медицинские товары" },
      "fitness_trackers": { label: "Фитнес‑гаджеты и трекеры" },
      "biohacking": { label: "Биохакинг и функциональное питание" },
      "nutrition": { label: "Спортивное питание и добавки" },
      "services": { label: "Услуги (салоны, телемедицина, консультации)" }
    }
  },
  "household": {
    label: "Для дома и быта",
    children: {
      "textiles": { label: "Текстиль и декор" },
      "kitchen": { label: "Кухонные принадлежности" },
      "household_items": { label: "Бытовые мелочи" },
      "lighting": { label: "Освещение и электрика" },
      "plumbing": { label: "Сантехника", children: {
          "mixers": { label: "Смесители" },
          "showers": { label: "Душевые" },
          "pipes_fittings": { label: "Трубы и фитинги" },
          "water_supply": { label: "Системы водоснабжения" }
        }
      }
    }
  },
  "pets": {
    label: "Питомцы",
    children: {
      "food": { label: "Корма и лакомства" },
      "accessories": { label: "Аксессуары и игрушки" },
      "smart_devices": { label: "Умные устройства для животных" },
      "veterinary": { label: "Ветеринарные товары и услуги" }
    }
  },
  "hobbies": {
    label: "Хобби, досуг и DIY",
    children: {
      "crafts": { label: "Материалы для творчества" },
      "electronics_diy": { label: "3D‑печать и электроника для сборки" },
      "stem": { label: "STEM‑наборы и развивающие игрушки" },
      "instruments": { label: "Музыкальные инструменты" },
      "tourism": { label: "Туризм и активный отдых" }
    }
  },
  "eco": {
    label: "Эко‑товары и устойчивость",
    children: {
      "solar": { label: "Солнечные панели и альтернативная энергия" },
      "efficient": { label: "Энергоэффективные устройства" },
      "materials": { label: "Перерабатываемые и биоразлагаемые материалы" },
      "transport": { label: "Электротранспорт" }
    }
  },
  "digital": {
    label: "Цифровые товары и услуги",
    children: {
      "licenses": { label: "Лицензии и подписки" },
      "courses": { label: "Онлайн‑курсы и обучение" },
      "microservices": { label: "Микро‑услуги и фриланс" },
      "content": { label: "Цифровой контент (шаблоны, медиа, NFT)" }
    }
  },
  "additional": {
    label: "Дополнительные блоки",
    children: {
      "finance": { label: "Финансы и инвестиции" },
      "education": { label: "Образование и карьера" },
      "food_delivery": { label: "Продукты питания и доставка" },
      "sports": { label: "Спорт и активный образ жизни" },
      "ar_vr": { label: "AR/VR‑категории" },
      "remote_work": { label: "Удалённая работа и офис" }
    }
  }
};

// Функция для получения плоского списка всех категорий
function flattenCategories(categories, parentKey = "") {
  const result = {};

  for (const [key, value] of Object.entries(categories)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;
    result[fullKey] = value.label;

    if (value.children) {
      Object.assign(result, flattenCategories(value.children, fullKey));
    }
  }

  return result;
}

// Плоский список всех категорий для обратной совместимости
const FLAT_CATEGORIES = flattenCategories(HIERARCHICAL_CATEGORIES);

module.exports = {
  HIERARCHICAL_CATEGORIES,
  FLAT_CATEGORIES,
  // Экспортируем также старые ключи для обратной совместимости
  CATEGORY_LABELS: FLAT_CATEGORIES,
  CATEGORY_KEYS: Object.keys(FLAT_CATEGORIES)
};
