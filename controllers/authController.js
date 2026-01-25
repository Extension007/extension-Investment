const User = require("../models/User");
const bcrypt = require("bcryptjs");
const { generateToken } = require("../config/jwt");
const { hasMongo } = require("../config/database");
const { sendVerificationEmail } = require("../services/emailVerificationService");
const { notifyAdmin } = require("../services/adminNotificationService");
const logger = require("../utils/logger");

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    // РџСЂРѕРІРµСЂСЏРµРј, РЅРµ СЃСѓС‰РµСЃС‚РІСѓРµС‚ Р»Рё СѓР¶Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email РёР»Рё username
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      // РћРїСЂРµРґРµР»СЏРµРј, С‡С‚Рѕ РёРјРµРЅРЅРѕ РїРѕРІС‚РѕСЂСЏРµС‚СЃСЏ - email РёР»Рё username
      if (existingUser.email === email) {
        return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
      } else {
        return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј РёРјРµРЅРµРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // РЎРѕР·РґР°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ СЃ emailVerified: false РїРѕ СѓРјРѕР»С‡Р°РЅРёСЋ
    const user = new User({
      username,
      email,
      password_hash: hashedPassword,
      role: "user",
      emailVerified: false // РќРѕРІС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅ
    });

    // Save the user first to get the user ID
    await user.save();

    // Check for referral code in query parameters after user is created
    const refCode = req.query.ref || req.body.ref || req.body.refCode;
    
    if (refCode) {
      const referrer = await User.findOne({ refCode: refCode });
      if (referrer && referrer._id.toString() !== user._id.toString()) { // Avoid self-referral
        user.referredBy = referrer._id;
        await user.save();
      }
    }

    try {
      await user.save();
    } catch (saveErr) {
      if (saveErr.code === 11000) {
        // РџСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РёРјРµРЅРЅРѕ РІС‹Р·РІР°Р»Рѕ РґСѓР±Р»РёРєР°С‚
        if (saveErr.keyPattern && saveErr.keyPattern.username) {
          return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј РёРјРµРЅРµРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
        } else if (saveErr.keyPattern && saveErr.keyPattern.email) {
          return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
        } else {
          return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРјРё РґР°РЅРЅС‹РјРё СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
        }
      } else {
        throw saveErr; // Р•СЃР»Рё СЌС‚Рѕ РґСЂСѓРіР°СЏ РѕС€РёР±РєР°, РїСЂРѕР±СЂР°СЃС‹РІР°РµРј РґР°Р»СЊС€Рµ
      }
    }

    // РћС‚РїСЂР°РІР»СЏРµРј СѓРІРµРґРѕРјР»РµРЅРёРµ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ Рѕ РЅРѕРІРѕР№ СЂРµРіРёСЃС‚СЂР°С†РёРё
    try {
      await notifyAdmin(
        'РќРѕРІС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ',
        `Р—Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ РЅРѕРІС‹Р№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ.`,
        {
          'РРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ': user.username,
          'Email': user.email,
          'Р”Р°С‚Р° СЂРµРіРёСЃС‚СЂР°С†РёРё': new Date().toLocaleString('ru-RU'),
          'ID РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ': user._id.toString()
        }
      );
    } catch (notificationError) {
      console.error('РћС€РёР±РєР° РїСЂРё РѕС‚РїСЂР°РІРєРµ СѓРІРµРґРѕРјР»РµРЅРёСЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂСѓ:', notificationError);
    }

    // Р“РµРЅРµСЂРёСЂСѓРµРј Рё РѕС‚РїСЂР°РІР»СЏРµРј С‚РѕРєРµРЅ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ (РµСЃР»Рё email РІРєР»СЋС‡РµРЅ)
    const emailConfig = require("../config/email");
    if (emailConfig.enabled) {
      try {
        await sendVerificationEmail(user);
      } catch (emailError) {
        // Р•СЃР»Рё РЅРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ email, СѓРґР°Р»СЏРµРј С‚РѕР»СЊРєРѕ С‡С‚Рѕ СЃРѕР·РґР°РЅРЅРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
        // Р”РѕРїРѕР»РЅРёС‚РµР»СЊРЅРѕ РїСЂРѕРІРµСЂСЏРµРј, С‡С‚Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ РёРјРµРµС‚ СЂРѕР»СЊ "user", Р° РЅРµ "admin"
        if (user.role === 'user') {
          await User.findByIdAndDelete(user._id);
        }
        console.error("РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё РїРёСЃСЊРјР° РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ:", emailError);
        return res.status(500).json({
          success: false,
          message: "РћС€РёР±РєР° СЂРµРіРёСЃС‚СЂР°С†РёРё: РЅРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РїРёСЃСЊРјРѕ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ"
        });
      }
    } else {
      // Р•СЃР»Рё email РѕС‚РєР»СЋС‡РµРЅ, СЃСЂР°Р·Сѓ РїРѕРґС‚РІРµСЂР¶РґР°РµРј РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
      user.emailVerified = true;
      await user.save();
    }

    // Р’РѕР·РІСЂР°С‰Р°РµРј РёРЅС„РѕСЂРјР°С†РёСЋ Рѕ РїРѕР»СЊР·РѕРІР°С‚РµР»Рµ Р±РµР· РїРѕР»РЅРѕРіРѕ С‚РѕРєРµРЅР°
    // РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р±СѓРґРµС‚ РЅРµР°РІС‚РѕСЂРёР·РѕРІР°РЅРЅС‹Рј РґРѕ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ email
    res.status(200).json({
      success: true,
      message: "Р РµРіРёСЃС‚СЂР°С†РёСЏ СѓСЃРїРµС€РЅР°. РџСЂРѕРІРµСЂСЊС‚Рµ РІР°С€ email РґР»СЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ.",
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified
      }
    });
  } catch (err) {
    console.error("РћС€РёР±РєР° СЂРµРіРёСЃС‚СЂР°С†РёРё:", err);
    // РћР±СЂР°Р±РѕС‚РєР° СЃРїРµС†РёС„РёС‡РµСЃРєРёС… РѕС€РёР±РѕРє MongoDB
    if (err.code === 11000) {
      if (err.keyPattern && err.keyPattern.username) {
        return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј РёРјРµРЅРµРј СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
      } else if (err.keyPattern && err.keyPattern.email) {
        return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРј email СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
      } else {
        return res.status(400).json({ success: false, message: "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СЃ С‚Р°РєРёРјРё РґР°РЅРЅС‹РјРё СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚" });
      }
    }
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
    if (user.role === "admin") {
      return res.render("user-login", { error: "Для входа администратора используйте /admin/login", csrfToken: res.locals.csrfToken });
    }
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
    const userData = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified
    };
    const isVercel = Boolean(process.env.VERCEL);
    const token = generateToken(userData);
    if (isVercel) {
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24
      });
    } else {
      req.session.user = userData;
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24
      });
    }
    logger.info({
      msg: 'user_login_success',
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified === true,
      source: 'web'
    });
    res.redirect("/cabinet");
  } catch (err) {
    logger.error({
      msg: 'user_login_error',
      error: err.message
    });
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
    if (user.role !== "admin") {
      return res.render("login", { error: "Доступ разрешен только администраторам", debug: null, csrfToken: res.locals.csrfToken });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.render("login", { error: "Неверный логин или пароль", debug: null, csrfToken: res.locals.csrfToken });
    }
    const userData = {
      _id: user._id.toString(),
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified
    };
    const isVercel = Boolean(process.env.VERCEL);
    const token = generateToken(userData);
    if (isVercel) {
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24
      });
    } else {
      req.session.user = userData;
      res.cookie('exto_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24
      });
    }
    logger.info({
      msg: 'admin_login_success',
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role,
      emailVerified: user.emailVerified === true,
      source: 'web'
    });
    res.redirect("/admin");
  } catch (err) {
    logger.error({
      msg: 'admin_login_error',
      error: err.message
    });
    res.status(500).send("Ошибка базы данных");
  }
};
exports.logout = async (req, res) => {
  const isVercel = Boolean(process.env.VERCEL);

  if (isVercel) {
    // Р’ Vercel serverless СѓРґР°Р»СЏРµРј cookie
    res.clearCookie('exto_user');
    res.clearCookie('exto_token');
  } else {
    // Р’ РѕР±С‹С‡РЅРѕР№ СЃСЂРµРґРµ СѓРЅРёС‡С‚РѕР¶Р°РµРј СЃРµСЃСЃРёСЋ
    req.session.destroy((err) => {
      if (err) {
        console.error("вќЊ РћС€РёР±РєР° РІС‹С…РѕРґР°:", err);
        return res.status(500).json({ success: false, message: "РћС€РёР±РєР° РІС‹С…РѕРґР°" });
      }
    });
    res.clearCookie('exto_token');
  }

  res.json({ success: true, message: "Р’С‹ СѓСЃРїРµС€РЅРѕ РІС‹С€Р»Рё" });
};




