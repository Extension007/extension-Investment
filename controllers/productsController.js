// FIX: Контроллер для обработки товаров
const Product = require("../models/Product");
const { deleteImages } = require("../utils/imageUtils");

// FIX: Получение всех товаров для отображения
exports.getAllProducts = async (req, res, next) => {
  try {
    const products = await Product.find({ status: "approved" })
      .populate('owner', 'username')
      .sort({ createdAt: -1 });
    
    res.render('index', {
      products,
      isAuth: !!req.session.user,
      isAdmin: req.session.user?.role === 'admin',
      categories: {
        home: "Для дома",
        beauty: "Красота и здоровье",
        auto: "Авто мото",
        electric: "Электрика",
        electronics: "Электроника",
        plumbing: "Сантехника"
      },
      selectedCategory: req.query.category || 'all',
      votedMap: {}
    });
  } catch (err) {
    next(err);
  }
};

// FIX: Получение формы добавления товара
exports.getAddForm = (req, res) => {
  res.render('products/add', {
    isAuth: !!req.session.user,
    isAdmin: req.session.user?.role === 'admin'
  });
};

// FIX: Создание нового товара
exports.createProduct = async (req, res, next) => {
  try {
    // FIX: Валидация и санитизация данных
    const { title, description, phone, email, telegram, whatsapp, price, link, video_url, category } = req.body;
    
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Название товара обязательно" });
    }

    const priceNum = Number(price);
    if (!priceNum || priceNum < 0) {
      return res.status(400).json({ success: false, message: "Некорректная цена" });
    }

    // FIX: Обработка загруженных изображений
    let images = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 5) {
        return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
      }

      req.files.forEach(file => {
        // FIX: Формируем путь к изображению
        if (file.path && !file.path.startsWith('http')) {
          // Локальное хранилище
          images.push('/uploads/' + file.filename);
        } else {
          // Cloudinary
          images.push(file.path);
        }
      });
    }

    // FIX: Проверка лимита изображений
    if (images.length > 5) {
      return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
    }

    // FIX: Формируем объект контактов
    const contacts = {
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      telegram: telegram ? telegram.trim() : "",
      whatsapp: whatsapp ? whatsapp.trim() : ""
    };

    // FIX: Создаем товар
    const productData = {
      name: title.trim(),
      description: description ? description.trim() : "",
      price: priceNum,
      link: link ? link.trim() : "",
      video_url: video_url ? video_url.trim() : "",
      images: images,
      contacts: contacts,
      category: category || "home",
      owner: req.session.user?._id || null,
      status: req.session.user?.role === 'admin' ? "approved" : "pending"
    };

    const product = await Product.create(productData);

    res.json({ success: true, product });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

// FIX: Получение формы редактирования товара
exports.getEditForm = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send("Товар не найден");
    }

    res.render('products/edit', {
      product,
      isAuth: !!req.session.user,
      isAdmin: req.session.user?.role === 'admin'
    });
  } catch (err) {
    next(err);
  }
};

// FIX: Обновление товара
exports.updateProduct = async (req, res, next) => {
  try {
    const { title, description, phone, email, telegram, whatsapp, price, link, video_url, category, current_images } = req.body;
    
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Товар не найден" });
    }

    // FIX: Валидация
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: "Название товара обязательно" });
    }

    const priceNum = Number(price);
    if (!priceNum || priceNum < 0) {
      return res.status(400).json({ success: false, message: "Некорректная цена" });
    }

    // FIX: Обработка изображений
    // Получаем старый массив изображений из базы
    const oldImages = product.images || [];
    console.log(`📸 Старые изображения в БД (${oldImages.length}):`, oldImages);
    
    // Получаем новый массив изображений (оставшиеся + новые)
    let newImages = [];
    
    // FIX: Если есть текущие изображения (из скрытого поля - это оставшиеся после удаления)
    if (current_images) {
      try {
        const parsedImages = typeof current_images === 'string' 
          ? JSON.parse(current_images) 
          : Array.isArray(current_images) 
            ? current_images 
            : [];
        newImages = parsedImages.filter(img => img && typeof img === 'string');
        console.log(`📸 Оставшиеся изображения из current_images (${newImages.length}):`, newImages);
      } catch (e) {
        console.warn("⚠️  Ошибка парсинга current_images:", e.message);
        // Если не удалось распарсить, используем старые изображения из БД
        newImages = oldImages;
      }
    } else {
      // Если current_images не передано, используем существующие
      newImages = [...oldImages];
    }

    // FIX: Добавляем новые загруженные изображения
    if (req.files && req.files.length > 0) {
      const uploadedImages = req.files.map(file => {
        if (file.path && !file.path.startsWith('http')) {
          return '/uploads/' + file.filename;
        } else {
          return file.path;
        }
      });
      console.log(`📸 Новые загруженные изображения (${uploadedImages.length}):`, uploadedImages);

      // Объединяем оставшиеся и новые, но не более 5
      newImages = [...newImages, ...uploadedImages].slice(0, 5);
    }

    console.log(`📸 Итоговый новый массив изображений (${newImages.length}):`, newImages);

    // FIX: Проверка лимита
    if (newImages.length > 5) {
      return res.status(400).json({ success: false, message: "Максимальное количество изображений: 5" });
    }

    // FIX: Находим изображения, которые нужно удалить (есть в старом, но нет в новом)
    // Сравниваем массивы: удалённые = старые, которых нет в новых
    const imagesToDelete = oldImages.filter(oldImg => {
      // Проверяем, есть ли старое изображение в новом массиве
      const existsInNew = newImages.some(newImg => {
        // Сравниваем как строки, учитывая возможные различия в формате URL
        return String(oldImg).trim() === String(newImg).trim();
      });
      return !existsInNew;
    });
    
    console.log(`🗑️  Изображения для удаления (${imagesToDelete.length}):`, imagesToDelete);
    
    // Удаляем изображения из хранилища (Cloudinary или локальное)
    if (imagesToDelete.length > 0) {
      try {
        const deletedCount = await deleteImages(imagesToDelete);
        // deleteImages уже логирует процесс, здесь только итоговый результат для карточки
        if (deletedCount < imagesToDelete.length) {
          console.warn(`⚠️  Для карточки ${product._id}: не все изображения удалены (${deletedCount}/${imagesToDelete.length})`);
        }
      } catch (err) {
        console.error(`❌ Ошибка удаления изображений при редактировании карточки ${product._id}:`, err);
        // Не прерываем выполнение, продолжаем обновление карточки
      }
    }

    // FIX: Формируем объект контактов
    const contacts = {
      phone: phone ? phone.trim() : "",
      email: email ? email.trim() : "",
      telegram: telegram ? telegram.trim() : "",
      whatsapp: whatsapp ? whatsapp.trim() : ""
    };

    // FIX: Обновляем товар
    // Используем $set для гарантированного обновления массива изображений и статуса
    const updateData = {
      name: title.trim(),
      description: description ? description.trim() : "",
      price: priceNum,
      link: link ? link.trim() : "",
      video_url: video_url ? video_url.trim() : "",
      images: newImages, // Новый массив изображений (заменяет старый)
      contacts: contacts,
      status: "pending" // ВСЕГДА сбрасываем статус на pending при редактировании
    };
    
    if (category) {
      updateData.category = category;
    }
    
    // Обновляем карточку
    Object.assign(product, updateData);
    
    console.log(`✅ Обновление карточки ${product._id}: статус установлен в "pending", изображений: ${newImages.length}`);

    await product.save();

    res.json({ success: true, product });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};
