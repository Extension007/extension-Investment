// Утилита для работы с иерархическими категориями
class CategorySelector {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      allowMultiple: false,
      showSearch: true,
      initialCategoryId: '',
      ...options
    };
    
    // Загружаем иерархическую структуру категорий
    this.categories = window.HIERARCHICAL_CATEGORIES || this.getDefaultCategories();
    
    this.selectedCategory = this.options.initialCategoryId;
    this.init();
  }
  
  getDefaultCategories() {
    // Возвращаем базовую структуру, если глобальная переменная не определена
    return {
      "home": {
        label: "🏠 Недвижимость и дом",
        children: {
          "apartments": { 
            label: "Квартиры", 
            children: {
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
        label: "🚗 Автомобили и транспорт",
        children: {
          "cars": { 
            label: "Автомобили", 
            children: {
              "new": { label: "Новые" },
              "used": { label: "Б/у" },
              "electric": { label: "Электромобили и зарядные станции" }
            }
          },
          "motorcycles": { label: "Мотоциклы и скутеры" },
          "bicycles": { label: "Велосипеды и электросамокаты" },
          "parts": { label: "Запчасти и аксессуары" },
          "electronics": { 
            label: "Автоэлектроника", 
            children: {
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
        label: "⚡ Электроника и техника",
        children: {
          "phones": { label: "Смартфоны и аксессуары" },
          "computers": { label: "Компьютеры и периферия" },
          "appliances": { 
            label: "Бытовая техника", 
            children: {
              "large": { label: "Крупная" },
              "small": { label: "Мелкая" }
            }
          },
          "audio_video": { label: "Аудио и видео техника" },
          "gaming": { 
            label: "Игровая электроника", 
            children: {
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
        label: "💄 Красота и здоровье",
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
        label: "🛒 Для дома и быта",
        children: {
          "textiles": { label: "Текстиль и декор" },
          "kitchen": { label: "Кухонные принадлежности" },
          "household_items": { label: "Бытовые мелочи" },
          "lighting": { label: "Освещение и электрика" },
          "plumbing": { 
            label: "Сантехника", 
            children: {
              "mixers": { label: "Смесители" },
              "showers": { label: "Душевые" },
              "pipes_fittings": { label: "Трубы и фитинги" },
              "water_supply": { label: "Системы водоснабжения" }
            }
          }
        }
      },
      "pets": {
        label: "🐾 Питомцы",
        children: {
          "food": { label: "Корма и лакомства" },
          "accessories": { label: "Аксессуары и игрушки" },
          "smart_devices": { label: "Умные устройства для животных" },
          "veterinary": { label: "Ветеринарные товары и услуги" }
        }
      },
      "hobbies": {
        label: "🎨 Хобби, досуг и DIY",
        children: {
          "crafts": { label: "Материалы для творчества" },
          "electronics_diy": { label: "3D‑печать и электроника для сборки" },
          "stem": { label: "STEM‑наборы и развивающие игрушки" },
          "instruments": { label: "Музыкальные инструменты" },
          "tourism": { label: "Туризм и активный отдых" }
        }
      },
      "eco": {
        label: "🌍 Эко‑товары и устойчивость",
        children: {
          "solar": { label: "Солнечные панели и альтернативная энергия" },
          "efficient": { label: "Энергоэффективные устройства" },
          "materials": { label: "Перерабатываемые и биоразлагаемые материалы" },
          "transport": { label: "Электротранспорт" }
        }
      },
      "digital": {
        label: "💻 Цифровые товары и услуги",
        children: {
          "licenses": { label: "Лицензии и подписки" },
          "courses": { label: "Онлайн‑курсы и обучение" },
          "microservices": { label: "Микро‑услуги и фриланс" },
          "content": { label: "Цифровой контент (шаблоны, медиа, NFT)" }
        }
      },
      "additional": {
        label: "🛍️ Дополнительные блоки",
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
  }
  
  init() {
    this.render();
    this.bindEvents();
    
    // Если была установлена начальная категория, восстанавливаем её
    if (this.options.initialCategoryId) {
      this.selectCategory(this.options.initialCategoryId);
    }
  }
  
  render() {
    this.container.innerHTML = `
      <div class="category-selector">
        ${this.options.showSearch ? `
          <div class="category-search">
            <input type="text" id="categorySearch" placeholder="Поиск категории..." />
          </div>
        ` : ''}
        <div class="category-tree" id="categoryTree">
          ${this.renderCategoryTree(this.categories)}
        </div>
        <div class="selected-category-display">
          <span id="selectedCategoryLabel">${this.selectedCategory ? this.getCategoryLabel(this.selectedCategory) : 'Категория не выбрана'}</span>
          <input type="hidden" id="selectedCategoryValue" name="category" value="${this.selectedCategory || ''}" />
        </div>
      </div>
    `;
  }
  
  renderCategoryTree(categories, level = 0, parentPath = '') {
    let html = `<ul class="category-level level-${level}">`;
    
    for (const [key, value] of Object.entries(categories)) {
      const fullPath = parentPath ? `${parentPath}.${key}` : key;
      const hasChildren = value.children && Object.keys(value.children).length > 0;
      const isSelected = this.selectedCategory === fullPath;
      
      html += `
        <li class="category-item ${isSelected ? 'selected' : ''}" data-category="${fullPath}">
          <div class="category-node">
            ${hasChildren ? '<span class="category-toggle">▶</span>' : '<span class="category-spacer"></span>'}
            <span class="category-label" data-category="${fullPath}">${value.label}</span>
          </div>
          ${hasChildren ? `
            <div class="category-children" style="display: none;">
              ${this.renderCategoryTree(value.children, level + 1, fullPath)}
            </div>
          ` : ''}
        </li>
      `;
    }
    
    html += '</ul>';
    return html;
  }
  
  bindEvents() {
    // Обработчик клика по метке категории
    this.container.querySelectorAll('.category-label').forEach(element => {
      element.addEventListener('click', (e) => {
        const category = e.currentTarget.getAttribute('data-category');
        this.selectCategory(category);
      });
    });
    
    // Обработчик клика по переключателю
    this.container.querySelectorAll('.category-toggle').forEach(element => {
      element.addEventListener('click', (e) => {
        e.stopPropagation();
        const toggle = e.currentTarget;
        const parentItem = toggle.closest('.category-item');
        const childrenContainer = parentItem.querySelector('.category-children');
        
        if (childrenContainer.style.display === 'none') {
          childrenContainer.style.display = 'block';
          toggle.textContent = '▼';
        } else {
          childrenContainer.style.display = 'none';
          toggle.textContent = '▶';
        }
      });
    });
    
    // Поиск по категориям
    if (this.options.showSearch) {
      const searchInput = this.container.querySelector('#categorySearch');
      searchInput.addEventListener('input', (e) => {
        this.searchCategories(e.target.value);
      });
    }
  }
  
  selectCategory(categoryPath) {
    // Обновляем выбранный элемент в интерфейсе
    this.container.querySelectorAll('.category-item').forEach(item => {
      item.classList.remove('selected');
    });
    
    const selectedItem = this.container.querySelector(`[data-category="${categoryPath}"]`);
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
    
    // Обновляем скрытое поле и отображение
    const hiddenInput = this.container.querySelector('#selectedCategoryValue');
    const labelDisplay = this.container.querySelector('#selectedCategoryLabel');
    
    if (hiddenInput) hiddenInput.value = categoryPath;
    if (labelDisplay) labelDisplay.textContent = this.getCategoryLabel(categoryPath);
    
    this.selectedCategory = categoryPath;
    
    // Вызываем коллбэк, если он определен
    if (this.options.onSelect) {
      this.options.onSelect(categoryPath);
    }
  }
  
  getCategoryLabel(categoryPath) {
    const pathParts = categoryPath.split('.');
    let current = this.categories;
    
    for (const part of pathParts) {
      if (current && current[part]) {
        current = current[part];
      } else {
        return categoryPath; // Возвращаем путь, если не нашли метку
      }
    }
    
    return current.label;
  }
  
  searchCategories(query) {
    if (!query) {
      // Если запрос пустой, показываем всю структуру
      this.render();
      this.bindEvents();
      return;
    }
    
    query = query.toLowerCase();
    const results = this.findMatchingCategories(this.categories, query);
    
    // Показываем только найденные категории
    this.container.querySelector('#categoryTree').innerHTML = this.renderSearchResults(results);
  }
  
  findMatchingCategories(categories, query, parentPath = '') {
    const results = [];
    
    for (const [key, value] of Object.entries(categories)) {
      const fullPath = parentPath ? `${parentPath}.${key}` : key;
      
      // Проверяем, совпадает ли метка с запросом
      if (value.label.toLowerCase().includes(query)) {
        results.push({
          path: fullPath,
          label: value.label,
          level: parentPath.split('.').length
        });
      }
      
      // Рекурсивно ищем в подкатегориях
      if (value.children) {
        const childResults = this.findMatchingCategories(value.children, query, fullPath);
        results.push(...childResults);
      }
    }
    
    return results;
  }
  
  renderSearchResults(results) {
    if (results.length === 0) {
      return '<div class="no-results">Категории не найдены</div>';
    }
    
    let html = '<ul class="category-search-results">';
    results.forEach(result => {
      const indent = '  '.repeat(result.level);
      html += `
        <li class="category-item search-result" data-category="${result.path}">
          <div class="category-node">
            <span class="category-spacer"></span>
            <span class="category-label" data-category="${result.path}">${indent}${result.label}</span>
          </div>
        </li>
      `;
    });
    html += '</ul>';
    
    return html;
  }
  
  // Метод для получения текущей выбранной категории
  getSelectedCategory() {
    return this.selectedCategory;
  }
  
  // Метод для установки категории программно
  setSelectedCategory(categoryPath) {
    this.selectCategory(categoryPath);
  }
}

// Экспортируем для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CategorySelector;
} else {
  window.CategorySelector = CategorySelector;
}