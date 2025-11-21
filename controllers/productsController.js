// FIX: Контроллер для обработки товаров
const Product = require("../models/Product");

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
    let images = [];
    
    // FIX: Если есть текущие изображения (из скрытого поля или из БД)
    if (current_images) {
      try {
        const currentImagesArray = typeof current_images === 'string' 
          ? JSON.parse(current_images) 
          : Array.isArray(current_images) 
            ? current_images 
            : [];
        images = currentImagesArray.filter(img => img);
      } catch (e) {
        // Если не удалось распарсить, используем старые изображения из БД
        images = product.images || [];
      }
    } else {
      // Если current_images не передано, используем существующие
      images = product.images || [];
    }

    // FIX: Добавляем новые загруженные изображения
    if (req.files && req.files.length > 0) {
      const newImages = req.files.map(file => {
        if (file.path && !file.path.startsWith('http')) {
          return '/uploads/' + file.filename;
        } else {
          return file.path;
        }
      });

      // FIX: Объединяем старые и новые, но не более 5
      images = [...images, ...newImages].slice(0, 5);
    }

    // FIX: Проверка лимита
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

    // FIX: Обновляем товар
    product.name = title.trim();
    product.description = description ? description.trim() : "";
    product.price = priceNum;
    product.link = link ? link.trim() : "";
    product.video_url = video_url ? video_url.trim() : "";
    product.images = images;
    product.contacts = contacts;
    if (category) product.category = category;

    await product.save();

    res.json({ success: true, product });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};
