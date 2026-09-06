const SUPPORTED = new Set(["ru", "en", "kk", "zh"]);

function normalizeLocale(locale) {
  return SUPPORTED.has(locale) ? locale : "en";
}

const COPY = {
  en: {
    emailFooterHelp: "Need help?",
    verification: {
      subject: "Confirm your email",
      preheader: "Confirm your email to finish signing up for ALBAMOUNT.",
      heading: "Welcome to ALBAMOUNT",
      greeting: "Hi, {{username}}! One step left: confirm your email so we can activate your profile.",
      cta: "Confirm email",
      fallback: "If the button doesn't work, copy this link:",
      validity: "This link works for {{validityPeriod}} and can be used once.",
      benefitsTitle: "After confirmation, you will be able to:",
      benefit1: "Publish your listings and videos",
      benefit2: "Receive bonuses and manage your ALBA balance",
      benefit3: "Chat with members and promote your projects",
      ignore: "If you did not sign up, just ignore this email.",
      plainIntro: "Thank you for signing up for ALBAMOUNT. To finish creating your account, confirm your email:",
      validityShort: "This link is valid for {{validityPeriod}}."
    },
    passwordReset: {
      subject: "Reset your Albamount password",
      preheader: "Use this link to set a new password for your account.",
      heading: "Password reset",
      greeting: "Hi, {{username}}! We received a request to reset your password.",
      cta: "Set new password",
      fallback: "If the button doesn't work, copy this link:",
      validity: "This link works for {{validityPeriod}} and can be used once.",
      ignore: "If you did not ask to reset the password, ignore this email — your password will stay the same.",
      plainIntro: "We received a request to reset your Albamount password. Open this link to choose a new one:"
    },
    admin: {
      subject: "Notification: {{eventType}}",
      preheader: "New ALBAMOUNT event: {{eventType}}",
      heading: "Administrator notification",
      typeLabel: "Event type:",
      cta: "Open admin panel"
    }
  },
  ru: {
    emailFooterHelp: "Нужна помощь?",
    verification: {
      subject: "Подтвердите email",
      preheader: "Подтвердите email, чтобы завершить регистрацию в ALBAMOUNT.",
      heading: "Добро пожаловать в ALBAMOUNT",
      greeting: "Привет, {{username}}! Остался один шаг — подтвердите почту, чтобы мы могли активировать ваш профиль.",
      cta: "Подтвердить email",
      fallback: "Если кнопка не работает, скопируйте ссылку:",
      validity: "Ссылка действует {{validityPeriod}} и работает один раз.",
      benefitsTitle: "После подтверждения вы сможете:",
      benefit1: "Публиковать свои карточки и видео",
      benefit2: "Получать бонусы и управлять балансом ALBA",
      benefit3: "Общаться с участниками и продвигать проекты",
      ignore: "Если вы не регистрировались, просто проигнорируйте это письмо.",
      plainIntro: "Спасибо за регистрацию в ALBAMOUNT. Чтобы завершить создание аккаунта, подтвердите ваш email:",
      validityShort: "Ссылка действует {{validityPeriod}}."
    },
    passwordReset: {
      subject: "Сброс пароля Albamount",
      preheader: "Ссылка для установки нового пароля.",
      heading: "Сброс пароля",
      greeting: "Привет, {{username}}! Мы получили запрос на сброс пароля.",
      cta: "Задать новый пароль",
      fallback: "Если кнопка не работает, скопируйте ссылку:",
      validity: "Ссылка действует {{validityPeriod}} и работает один раз.",
      ignore: "Если вы не запрашивали сброс — просто проигнорируйте письмо, пароль не изменится.",
      plainIntro: "Запрос на сброс пароля Albamount. Откройте ссылку, чтобы задать новый пароль:"
    },
    admin: {
      subject: "Уведомление: {{eventType}}",
      preheader: "Новое событие в ALBAMOUNT: {{eventType}}",
      heading: "Уведомление администратору",
      typeLabel: "Тип события:",
      cta: "Перейти в админ-панель"
    }
  },
  kk: {
    emailFooterHelp: "Көмек керек пе?",
    verification: {
      subject: "Email мекенжайын растаңыз",
      preheader: "ALBAMOUNT тіркелуін аяқтау үшін email мекенжайын растаңыз.",
      heading: "ALBAMOUNT-қа қош келдіңіз",
      greeting: "Сәлем, {{username}}! Бір қадам қалды: профиліңізді белсендіру үшін email мекенжайыңызды растаңыз.",
      cta: "Email растау",
      fallback: "Егер батырма жұмыс істемесе, мына сілтемені көшіріңіз:",
      validity: "Бұл сілтеме {{validityPeriod}} бойы жарамды және бір рет қолданылады.",
      benefitsTitle: "Растағаннан кейін сіз мыналарды жасай аласыз:",
      benefit1: "Өз хабарландыруларыңыз бен видеоларыңызды жариялау",
      benefit2: "Бонустар алу және ALBA балансын басқару",
      benefit3: "Қатысушылармен сөйлесу және жобаларды ілгерілету",
      ignore: "Егер сіз тіркелмеген болсаңыз, бұл хатты елемеңіз.",
      plainIntro: "ALBAMOUNT-қа тіркелгеніңізге рақмет. Аккаунт жасауды аяқтау үшін email мекенжайыңызды растаңыз:",
      validityShort: "Бұл сілтеме {{validityPeriod}} бойы жарамды."
    },
    passwordReset: {
      subject: "Albamount құпия сөзін қалпына келтіру",
      preheader: "Жаңа құпия сөз орнату сілтемесі.",
      heading: "Құпия сөзді қалпына келтіру",
      greeting: "Сәлем, {{username}}! Құпия сөзді қалпына келтіру сұрауы келді.",
      cta: "Жаңа құпия сөз орнату",
      fallback: "Батырма істемесе, сілтемені көшіріңіз:",
      validity: "Сілтеме {{validityPeriod}} бойы жарамды және бір рет қолданылады.",
      ignore: "Егер сіз сұрамаған болсаңыз — хатты елемеңіз, құпия сөз өзгермейді.",
      plainIntro: "Albamount құпия сөзін қалпына келтіру сұрауы. Жаңасын орнату үшін сілтемені ашыңыз:"
    },
    admin: {
      subject: "Хабарлама: {{eventType}}",
      preheader: "ALBAMOUNT-та жаңа оқиға: {{eventType}}",
      heading: "Әкімшіге хабарлама",
      typeLabel: "Оқиға түрі:",
      cta: "Әкімші панелін ашу"
    }
  },
  zh: {
    emailFooterHelp: "需要帮助？",
    verification: {
      subject: "请确认您的邮箱",
      preheader: "确认您的邮箱以完成 ALBAMOUNT 注册。",
      heading: "欢迎来到 ALBAMOUNT",
      greeting: "您好，{{username}}！还差最后一步：请确认您的邮箱，我们就能激活您的账号。",
      cta: "确认邮箱",
      fallback: "如果按钮无法使用，请复制此链接：",
      validity: "此链接在 {{validityPeriod}} 内有效，且只能使用一次。",
      benefitsTitle: "确认后，您将可以：",
      benefit1: "发布您的信息卡片和视频",
      benefit2: "获得奖励并管理您的 ALBA 余额",
      benefit3: "与用户交流并推广您的项目",
      ignore: "如果这不是您本人注册，请直接忽略此邮件。",
      plainIntro: "感谢您注册 ALBAMOUNT。要完成账号创建，请确认您的邮箱：",
      validityShort: "此链接在 {{validityPeriod}} 内有效。"
    },
    passwordReset: {
      subject: "重置 Albamount 密码",
      preheader: "使用此链接设置新密码。",
      heading: "重置密码",
      greeting: "您好，{{username}}！我们收到了重置密码的请求。",
      cta: "设置新密码",
      fallback: "如果按钮无法使用，请复制此链接：",
      validity: "此链接在 {{validityPeriod}} 内有效，且只能使用一次。",
      ignore: "如非本人操作，请忽略此邮件，密码不会更改。",
      plainIntro: "我们收到了重置 Albamount 密码的请求。打开此链接设置新密码："
    },
    admin: {
      subject: "通知：{{eventType}}",
      preheader: "ALBAMOUNT 有新事件：{{eventType}}",
      heading: "管理员通知",
      typeLabel: "事件类型：",
      cta: "打开管理面板"
    }
  }
};

function interpolate(text, vars = {}) {
  return String(text).replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function emailCopy(locale) {
  return COPY[normalizeLocale(locale)];
}

module.exports = {
  normalizeLocale,
  emailCopy,
  interpolate
};
