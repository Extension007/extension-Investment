const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../config/jwt");
const { hasMongo } = require("../config/database");
const { sendVerificationEmail } = require("../services/emailVerificationService");
const { notifyAdmin } = require("../services/adminNotificationService");

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    // Проверяем, не существует ли уже пользователь с таким email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Пользователь с таким email уже существует" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Создаем пользователя с emailVerified: false по умолчанию
    const user = new User({
      username,
      email,
      password_hash: hashedPassword,
      role: "user",
      emailVerified: false // Новый пользователь не подтвержден
    });
    await user.save();

    // Отправляем уведомление администратору о новой регистрации
    try {
      await notifyAdmin(
        'Новый пользователь зарегистрирован',
        `Зарегистрирован новый пользователь.`,
        {
          'Имя пользователя': user.username,
          'Email': user.email,
          'Дата регистрации': new Date().toLocaleString('ru-RU'),
          'ID пользователя': user._id.toString()
        }
      );
    } catch (notificationError) {
      console.error('Ошибка при отправке уведомления администратору:', notificationError);
    }

    // Генерируем и отправляем токен подтверждения
    try {
      await sendVerificationEmail(user);
    } catch (emailError) {
      // Если не удалось отправить email, удаляем только что созданного пользователя
      // Дополнительно проверяем, что пользователь имеет роль "user", а не "admin"
      if (user.role === 'user') {
        await User.findByIdAndDelete(user._id);
      }
      console.error("Ошибка отправки письма подтверждения:", emailError);
      return res.status(500).json({
        success: false,
        message: "Ошибка регистрации: не удалось отправить письмо подтверждения"
      });
    }

    // Возвращаем информацию о пользователе без полного токена
    // Пользователь будет неавторизованным до подтверждения email
    res.status(200).json({
      success: true,
      message: "Регистрация успешна. Проверьте ваш email для подтверждения.",
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    console.error("Ошибка регистрации:", err);
    res.status(500).json({ success: false, message: "Registration failed", error: err.message });
  }
};

exports.userLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render("user-login", { error: "Неверный логин или пароль", csrfToken: res.locals.csrfToken });
    }
    
    // Проверяем, является ли пользователь администратором
    if (user.role === "admin") {
      return res.render("user-login", { error: "Для входа администратора используйте /admin/login", csrfToken: res.locals.csrfToken });
    }
    
    // Проверяем статус подтверждения email
    if (!user.emailVerified) {
      return res.render("user-login", {
        error: "Пожалуйста, подтвердите ваш email перед входом. Проверьте папку Входящие или Спам.",
        csrfToken: res.locals.csrfToken,
        showResendVerification: true,
        email: user.email
      });
    }
    
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("user-login", { error: "Неверный логин или пароль", csrfToken: res.locals.csrfToken });
    }

    // Сохраняем _id как строку для совместимости
    const userData = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified
    };

    const isVercel = Boolean(process.env.VERCEL);
    const token = generateToken(userData);

    if (isVercel) {
      // В Vercel serverless используем cookie для хранения данных пользователя
      res.cookie('exto_user', JSON.stringify(userData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 // 1 час
      });
      // Также возвращаем JWT токен для API вызовов
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 24 // 24 часа
      });
    } else {
      // В обычной среде используем сессии
      req.session.user = userData;
      // Также возвращаем JWT токен для API вызовов
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 24 // 24 часа
      });
    }

    console.log("✅ Пользователь залогинен:", {
      username: user.username,
      role: user.role,
      id: user._id.toString()
    });
    res.redirect("/cabinet");
  } catch (err) {
    console.error("❌ Ошибка входа:", err);
    res.status(500).send("Ошибка базы данных");
  }
};

exports.adminLogin = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null, csrfToken: res.locals.csrfToken });
    }
    // Проверяем роль админа
    if (user.role !== "admin") {
      return res.render("login", { error: "Доступ разрешен только администраторам", debug: null, csrfToken: res.locals.csrfToken });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null, csrfToken: res.locals.csrfToken });
    }

    // Сохраняем _id как строку для совместимости
    const userData = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role
    };

    const isVercel = Boolean(process.env.VERCEL);
    const token = generateToken(userData);

    if (isVercel) {
      // В Vercel serverless используем cookie для хранения данных пользователя
      res.cookie('exto_user', JSON.stringify(userData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 // 1 час
      });
      // Также возвращаем JWT токен для API вызовов
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 24 // 24 часа
      });
    } else {
      // В обычной среде используем сессии
      req.session.user = userData;
      // Также возвращаем JWT токен для API вызовов
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 24 // 24 часа
      });
    }

    console.log("✅ Админ залогинен:", {
      username: user.username,
      role: user.role,
      id: user._id.toString()
    });
    res.redirect("/admin");
  } catch (err) {
    console.error("❌ Ошибка входа:", err);
    res.status(500).send("Ошибка базы данных");
  }
};

exports.logout = async (req, res) => {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    // В Vercel serverless удаляем cookie
    res.clearCookie('exto_user');
    res.clearCookie('exto_token');
  } else {
    // В обычной среде уничтожаем сессию
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Ошибка выхода:", err);
        return res.status(500).json({ success: false, message: "Ошибка выхода" });
      }
    });
    res.clearCookie('exto_token');
  }

  res.json({ success: true, message: "Вы успешно вышли" });
};
