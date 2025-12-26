const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { hasMongo } = require("../config/database");

exports.register = async (req, res) => {
  try {
    // Проверяем доступность MongoDB
    if (!hasMongo()) {
      return res.status(503).json({ error: "MongoDB недоступна" });
    }

    const { username, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password_hash: hashedPassword, role: "user" });
    await user.save();

    // Сохраняем _id как строку для совместимости
    const userData = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role
    };

    const isVercel = Boolean(process.env.VERCEL);
    if (isVercel) {
      // В Vercel serverless используем cookie для хранения данных пользователя
      res.cookie('exto_user', JSON.stringify(userData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 // 1 час
      });
    } else {
      // В обычной среде используем сессии
      req.session.user = userData;
    }

    res.status(200).json({ success: true, user: { id: user._id, email: user.email } });
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
    // Пользователи не могут входить через админку
    if (user.role === "admin") {
      return res.render("user-login", { error: "Для входа администратора используйте /admin/login", csrfToken: res.locals.csrfToken });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("user-login", { error: "Неверный логин или пароль", csrfToken: res.locals.csrfToken });
    }

    // Сохраняем _id как строку для совместимости
    const userData = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role
    };

    const isVercel = Boolean(process.env.VERCEL);
    if (isVercel) {
      // В Vercel serverless используем cookie для хранения данных пользователя
      res.cookie('exto_user', JSON.stringify(userData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 // 1 час
      });
    } else {
      // В обычной среде используем сессии
      req.session.user = userData;
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
    if (isVercel) {
      // В Vercel serverless используем cookie для хранения данных пользователя
      res.cookie('exto_user', JSON.stringify(userData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 // 1 час
      });
    } else {
      // В обычной среде используем сессии
      req.session.user = userData;
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
  } else {
    // В обычной среде уничтожаем сессию
    req.session.destroy((err) => {
      if (err) {
        console.error("❌ Ошибка выхода:", err);
        return res.status(500).json({ success: false, message: "Ошибка выхода" });
      }
    });
  }

  res.json({ success: true, message: "Вы успешно вышли" });
};
