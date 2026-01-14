# Backend/Web Audit Report (Node.js/Express)

Дата: 2026-01-14
Окружение: Windows PowerShell, `c:\exto-project`

## 1) Executive Summary
- Продакшн‑готовность: **нет** — Vercel‑режим ломает защищённые API (CSRF + `req.session`) и приводит к 403/500.
- Подтвержден критический CSRF‑разрыв в Vercel: токен не выдаётся, но `csurf` активен в API → все POST/PUT/DELETE падают 403.
- Подтверждено в коде: `routes/api.js` обращается к `req.session.user`, хотя в Vercel сессии не включены.
- В логи пишутся секреты (`MONGODB_URI`, `SESSION_SECRET`) — риск компрометации и инцидентов.
- Публичный `/__health/cloudinary` делает реальный upload → риск затрат/DoS.
- Rate‑limit для логинов объявлен, но не используется.
- Админ‑контакты изменяются без CSRF‑проверки.
- Открыт отладочный `/api/comments/test/:cardId` с утечкой auth/cookie state.
- Массовые выборки без пагинации на ключевых страницах → деградация по мере роста данных.
- `Statistics.findOneAndUpdate()` и `User.countDocuments()` исполняются на каждом page view → лишние записи/сканы.
- `/api/instagram/oembed` без таймаута → риск зависания воркеров.
- `BASE_URL` критичен для Origin‑check; неверное значение блокирует небезопасные методы в prod.

## 2) Route Inventory
(полный инвентарь по коду `routes/*` + вложенные `router.use`)

| Method | Path | Handler (file) | Middleware chain | Auth | Validation | Side effects | Response | Failure points |
|---|---|---|---|---|---|---|---|---|
| POST | `/logout` | `routes/auth.js` | — | auth (cookie/session) | — | clear cookie/session | redirect | session destroy error |
| POST | `/register` | `controllers/authController.register` | — | public | in‑controller checks | user create, email, notify | JSON | SMTP/DB errors |
| GET | `/user/login` | `routes/auth.js` | — | public | — | render | HTML | — |
| POST | `/user/login` | `controllers/authController.userLogin` | — | public | in‑controller checks | set session/JWT | redirect | auth failure, DB |
| GET | `/admin/login` | `routes/auth.js` | — | public | — | render | HTML | — |
| POST | `/admin/login` | `controllers/authController.adminLogin` | — | public | in‑controller checks | set session/JWT | redirect | auth failure |
| GET | `/verify-email/:token` | `controllers/emailVerificationController.verifyEmail` | — | public | token | DB update + notify | render | invalid token |
| POST | `/resend-verification` | `controllers/emailVerificationController.resendVerification` | — | public | email | email send | JSON | SMTP |
| GET | `/verification-status` | `controllers/emailVerificationController.verificationStatus` | — | auth | — | DB read | render/redirect | auth missing |
| GET | `/` | `routes/index.js` | — | public | query category | DB reads + stats write | render | DB errors |
| GET | `/products` | `routes/products.js` | — | public | query category | DB reads + stats write | render | DB errors |
| GET | `/services` | `routes/services.js` | — | public | query category | DB reads + stats write | render | DB errors |
| GET | `/about` | `routes/about.js` | — | public | query category | DB reads + stats write | render | DB errors |
| GET | `/ad` | `routes/ad.js` | — | public | — | DB reads + stats write | render | DB errors |
| GET | `/contacts` | `controllers/contactController.getContacts` | — | public | — | DB read | render | DB errors |
| GET | `/health` | `routes/index.js` | — | public | — | DB state | JSON | — |
| GET | `/__health/cloudinary` | `routes/index.js` | — | public | — | **Cloudinary upload** | JSON | Cloudinary fail |
| GET | `/.well-known/*` | `routes/index.js` | — | public | — | — | 404 | — |
| POST | `/api/rating/:id` | `routes/api.js` | `apiLimiter`, `csurf`, validators | public | productId + rating | DB update + cookie | JSON | CSRF, DB |
| GET | `/api/rating/:id` | `routes/api.js` | `apiLimiter`, validator | public | productId | DB read | JSON | DB |
| GET | `/api/instagram/oembed` | `routes/api.js` | `apiLimiter`, validator | public | url | external HTTP | JSON | timeout |
| DELETE | `/api/images/:productId/:index` | `routes/api.js` | `apiLimiter`, `csurf` | auth | param checks | Cloudinary delete + DB update | JSON/204 | CSRF, DB |
| DELETE | `/api/products/:id` | `routes/api.js` | `apiLimiter`, `requireUser`, `csurf` | auth (owner/admin) | id | Cloudinary delete + DB delete | JSON | CSRF, DB |
| GET | `/api/products` | `routes/api.js` | `apiLimiter` | public | — | DB read | JSON | DB |
| GET | `/api/products/:id` | `routes/api.js` | `apiLimiter` | public | id | DB read | JSON | DB |
| PUT | `/api/products/:id` | `routes/api.js` | `apiLimiter`, `requireUser`, `csurf` | auth (owner/admin) | id, status | DB update | JSON | CSRF, DB |
| GET | `/api/banners` | `routes/api.js` | `apiLimiter` | public | — | DB read | JSON | DB |
| GET | `/api/banners/:id` | `routes/api.js` | `apiLimiter` | public | id | DB read | JSON | DB |
| POST | `/api/banners` | `routes/api.js` | `apiLimiter`, `requireUser`, `csurf` | auth | body | DB create | JSON | CSRF, DB |
| PUT | `/api/banners/:id` | `routes/api.js` | `apiLimiter`, `requireUser`, `csurf` | auth (owner/admin) | id | DB update | JSON | CSRF, DB |
| DELETE | `/api/banners/:id` | `routes/api.js` | `apiLimiter`, `requireUser`, `csurf` | auth (owner/admin) | id | delete + DB | JSON | CSRF, DB |
| POST | `/api/banners/:id/vote` | `routes/api.js` | `apiLimiter`, `csurf`, validator | public | id + vote | DB update + cookie | JSON | CSRF |
| GET | `/api/services` | `routes/api.js` | `apiLimiter` | public | — | DB read | JSON | DB |
| GET | `/api/services/:id` | `routes/api.js` | `apiLimiter` | public | id | DB read | JSON | DB |
| POST | `/api/services` | `routes/api.js` | `apiLimiter`, `requireUser`, `requireEmailVerification`, `csurf` | auth+verified | body | DB create | JSON | CSRF, DB |
| PUT | `/api/services/:id` | `routes/api.js` | `apiLimiter`, `requireUser`, `csurf` | auth (owner/admin) | id | DB update | JSON | CSRF, DB |
| DELETE | `/api/services/:id` | `routes/api.js` | `apiLimiter`, `requireUser`, `csurf` | auth (owner/admin) | id | delete + DB | JSON | CSRF, DB |
| POST | `/api/services/:id/vote` | `routes/api.js` | `apiLimiter`, `csurf`, validator | public | id + vote | DB update + cookie | JSON | CSRF |
| GET | `/api/contacts` | `routes/api.js` | — | public | — | DB read | JSON | DB |
| GET | `/api/contacts/:id` | `routes/api.js` | — | public | id | DB read | JSON | DB |
| GET | `/api/comments/:cardId` | `routes/comments.js` | param validator | public | id, page/limit | DB read | JSON | DB |
| POST | `/api/comments/test/:cardId` | `routes/comments.js` | — | public | — | logs auth state | JSON | info leak |
| POST | `/api/comments/:cardId` | `routes/comments.js` | `canWriteComments`, `commentLimiter` | auth | id + text | DB create + socket emit | JSON | DB |
| PUT | `/api/comments/:id` | `routes/comments.js` | `canEditComments`, `csurf`, validators | admin | id + text | DB update | JSON | CSRF |
| DELETE | `/api/comments/:id` | `routes/comments.js` | `canDeleteComments`, `csurf`, validators | admin | id | soft delete | JSON | CSRF |
| GET | `/api/categories/tree/:type?` | `routes/categories.js` | — | public | type | DB read | JSON | DB |
| GET | `/api/categories/flat/:type?` | `routes/categories.js` | — | public | type | DB read | JSON | DB |
| GET | `/api/categories/children/:parentId` | `routes/categories.js` | — | public | parentId | DB read | JSON | DB |
| POST | `/api/categories` | `routes/categories.js` | `requireAdmin` | admin | body | DB create | JSON | DB |
| PUT | `/api/categories/:id` | `routes/categories.js` | `requireAdmin` | admin | id + body | DB update | JSON | DB |
| DELETE | `/api/categories/:id` | `routes/categories.js` | `requireAdmin` | admin | id | DB delete | JSON | DB |
| GET | `/cabinet` | `routes/cabinet.js` | `requireUser`, `csrfToken` (non‑Vercel) | auth | — | DB read | render | DB |
| POST | `/cabinet/product` | `routes/cabinet.js` | `requireUser`, `productLimiter`, `mobileOptimization`, `upload`, `csurf`, validators | auth | body+files | upload + DB create | JSON | upload/CSRF/DB |
| POST | `/cabinet/product/:id/price` | `routes/cabinet.js` | `requireUser`, `csurf`, validateProductId | auth | id + price | DB update | JSON | DB |
| GET | `/cabinet/product/:id/edit` | `routes/cabinet.js` | `requireUser`, validateProductId, csrfToken | auth | id | DB read | render | DB |
| POST | `/cabinet/product/:id/edit` | `routes/cabinet.js` | `requireUser`, limiter, upload, `csurf`, validators | auth | body+files | upload + DB update | JSON | upload/CSRF/DB |
| POST | `/cabinet/banner` | `routes/cabinet.js` | `requireUser`, limiter, bannerUpload, `csurf` | auth | file | upload + DB create | JSON | upload/CSRF/DB |
| GET | `/cabinet/banner/:id/edit` | `routes/cabinet.js` | `requireUser`, csrfToken | auth | id | DB read | render | DB |
| POST | `/cabinet/banner/:id/edit` | `routes/cabinet.js` | `requireUser`, limiter, bannerUpload, `csurf` | auth | body+files | upload + DB update | JSON | upload/CSRF/DB |
| DELETE | `/cabinet/product/:id` | `routes/cabinet.js` | `requireUser`, `csurf` | auth | id | soft delete | JSON | CSRF/DB |
| DELETE | `/cabinet/banner/:id` | `routes/cabinet.js` | `requireUser`, `csurf` | auth | id | delete + cloudinary | JSON | CSRF/DB |
| GET | `/admin` | `routes/admin.js` | `requireAdmin`, csrfToken | admin | — | DB read | render | DB |
| POST | `/admin/products` | `routes/admin.js` | `requireAdmin`, limiter, upload, `csurf`, validators | admin | body+files | upload + DB create | JSON/redirect | CSRF/DB |
| POST | `/admin/products/:id/delete` | `routes/admin.js` | `requireAdmin`, `csurf`, validators | admin | id | delete + notify | JSON/redirect | CSRF/DB |
| GET | `/admin/products/:id/edit` | `routes/admin.js` | `requireAdmin`, validators, csrfToken | admin | id | DB read | render | DB |
| POST | `/admin/products/:id/edit` | `routes/admin.js` | `requireAdmin`, upload, `csurf`, validators | admin | body+files | update + upload | JSON/redirect | CSRF/DB |
| POST | `/admin/products/:id/approve` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id | DB update + notify | JSON | DB |
| POST | `/admin/products/:id/reject` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id + reason | DB update + notify | JSON | DB |
| POST | `/admin/products/:id/toggle-visibility` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id | DB update | JSON | DB |
| POST | `/admin/services/:id/approve` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id | DB update + notify | JSON | DB |
| POST | `/admin/services/:id/reject` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id + reason | DB update + notify | JSON | DB |
| POST | `/admin/services/:id/toggle-visibility` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id | DB update | JSON | DB |
| GET | `/admin/services/:id/edit` | `routes/admin.js` | `requireAdmin`, validators, csrfToken | admin | id | DB read | render | DB |
| POST | `/admin/services/:id/edit` | `routes/admin.js` | `requireAdmin`, upload, `csurf`, validators | admin | body+files | update + upload | JSON/redirect | CSRF/DB |
| POST | `/admin/services/:id/delete` | `routes/admin.js` | `requireAdmin`, `csurf`, validators | admin | id | delete + notify | JSON/redirect | CSRF/DB |
| GET | `/admin/products` | `routes/admin.js` | `requireAdmin`, csrfToken | admin | — | DB read | render | DB |
| GET | `/admin/services` | `routes/admin.js` | `requireAdmin`, csrfToken | admin | — | DB read | render | DB |
| GET | `/admin/banners` | `routes/admin.js` | `requireAdmin`, csrfToken | admin | — | DB read | render | DB |
| POST | `/admin/banners` | `routes/admin.js` | `requireAdmin`, upload, `csurf`, validators | admin | body+files | create + upload | JSON/redirect | CSRF/DB |
| GET | `/admin/banners/:id/edit` | `routes/admin.js` | `requireAdmin`, validators, csrfToken | admin | id | DB read | render | DB |
| POST | `/admin/banners/:id/edit` | `routes/admin.js` | `requireAdmin`, upload, `csurf`, validators | admin | body+files | update + upload | JSON/redirect | CSRF/DB |
| POST | `/admin/banners/:id/delete` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id | delete + notify | JSON/redirect | CSRF/DB |
| DELETE | `/admin/banners/:id` | `routes/admin.js` | `requireAdmin`, `csurf` | admin | id | delete + cloudinary | JSON | CSRF/DB |
| GET | `/admin/categories` | `routes/admin.js` | `requireAdmin`, csrfToken | admin | — | render | HTML | DB |
| GET | `/admin/contacts` | `routes/adminContacts.js` | `requireAdmin`, csrfToken only | admin | — | DB read | render | CSRF missing |
| POST | `/admin/contacts/create` | `routes/adminContacts.js` | `requireAdmin`, csrfToken only | admin | body | DB create + notify | JSON | CSRF missing |
| POST | `/admin/contacts/:id/update` | `routes/adminContacts.js` | `requireAdmin`, csrfToken only | admin | body | DB update + notify | JSON | CSRF missing |
| POST | `/admin/contacts/:id/delete` | `routes/adminContacts.js` | `requireAdmin`, csrfToken only | admin | body | DB delete + notify | JSON/redirect | CSRF missing |

## 3) Findings

### Critical

**C1. Vercel‑режим ломает auth API: `req.session.user` используется в API без сессий**
- **Evidence:** `routes/api.js:188-189`, `routes/api.js:266-267`, `routes/api.js:385-386`, `routes/api.js:530-531`, `routes/api.js:813-814` (множественные обращения к `req.session.user`); при этом сессии включаются только вне Vercel: `config/app.js:58-88`.
- **Impact:** в Vercel `req.session` не существует → `TypeError` при авторизованных запросах (PUT/DELETE/POST), нестабильность API.
- **Reproduction:**
  - Симуляция Vercel‑режима (см. раздел Dynamic Tests). Фактическая проверка заблокирована CSRF‑ошибкой C2 — запросы не проходят до кода с `req.session`.
- **Recommended fix:** в API использовать `req.user` (из `getUserFromRequest`) вместо `req.session`, либо включить session middleware в Vercel‑режиме.
- **Pseudo‑diff (concept):**
  ```diff
  - const isAdmin = req.session.user.role === "admin";
  - const isOwner = product.owner && product.owner.toString() === req.session.user._id.toString();
  + const isAdmin = req.user?.role === "admin";
  + const isOwner = product.owner && product.owner.toString() === req.user?._id?.toString();
  ```

**C2. CSRF в Vercel: токен не выдается, но `csurf` включен в API**
- **Evidence:** `middleware/csrf.js:6-18` отключает CSRF‑middleware и выдачу токена в Vercel; `routes/api.js:10` всегда подключает `csurf({ cookie: true })`.
- **Impact:** все небезопасные методы API в Vercel получают `403 EBADCSRFTOKEN`; легитимные клиенты не могут отправлять POST/PUT/DELETE.
- **Reproduction (Vercel‑mode):**
  ```powershell
  $env:VERCEL='1'; $env:NODE_ENV='production'; $env:PORT='3005'; node server.js
  Invoke-WebRequest http://localhost:3005/user/login  # _csrf пуст
  Invoke-WebRequest -Method POST http://localhost:3005/api/banners/000000000000000000000000/vote -Body @{vote='up'}
  # -> 403
  ```
  Фактический результат: `VERCEL_MODE_CSRF_TOKEN_VALUE=''`, `VERCEL_MODE_CSRF_MISSING_STATUS=403`.
- **Recommended fix:** согласовать CSRF‑механику для Vercel (либо отключить `csurf` в API под Vercel, либо выдавать токен и хранить секрет в cookie).

### High

**H1. Секреты пишутся в логи**
- **Evidence:** `config/database.js:9-10` логирует `MONGODB_URI` и `SESSION_SECRET`.
- **Impact:** утечка секретов через логи, компрометация инфраструктуры.
- **Reproduction:**
  ```powershell
  node server.js
  # В stdout печатаются MONGODB_URI и SESSION_SECRET
  ```
- **Recommended fix:** убрать логирование секретов или маскировать значения.

**H2. Публичный `/__health/cloudinary` делает реальный upload**
- **Evidence:** `routes/index.js:200-205` вызывает `cloudinary.uploader.upload(...)`.
- **Impact:** любой пользователь может вызывать платные операции; возможен DoS/затраты.
- **Reproduction:**
  ```powershell
  Invoke-WebRequest http://localhost:3002/__health/cloudinary
  # Ответ содержит public_id/secure_url → подтверждение upload
  ```
- **Recommended fix:** закрыть эндпоинт (auth/IP allowlist) или заменить на `ping` без загрузки.

**H3. Login rate‑limit не применяется**
- **Evidence:** `middleware/rateLimiter.js:5` определяет `loginLimiter`; в `routes/auth.js:48-54` login‑маршруты без лимитера.
- **Impact:** повышенный риск brute‑force и деградации.
- **Reproduction:** код‑аудит (runtime не требуется).
- **Recommended fix:** применить `loginLimiter` к `/user/login` и `/admin/login`.

**H4. Админ‑контакты без CSRF‑проверки**
- **Evidence:** `routes/adminContacts.js:49`, `routes/adminContacts.js:114`, `routes/adminContacts.js:193` — только `conditionalCsrfToken`, отсутствует `csurf`.
- **Impact:** CSRF‑модификация админ‑контактов.
- **Reproduction:** отправка POST с чужого источника (CSRF) изменит данные.
- **Recommended fix:** добавить `csurf` middleware.

**H5. Публичный `/api/comments/test/:cardId` раскрывает auth/cookie state**
- **Evidence:** `routes/comments.js:92` — отладочный эндпоинт, логирует и возвращает auth‑данные.
- **Impact:** информационная утечка; помогает атакующему понять состояние auth.
- **Reproduction:**
  ```powershell
  Invoke-WebRequest -Method POST http://localhost:3002/api/comments/test/000000000000000000000000
  ```
- **Recommended fix:** удалить/закрыть эндпоинт.

### Medium

**M1. При падении БД `HAS_MONGO` остаётся true, маршруты не проверяют `hasMongo()`**
- **Evidence:** `routes/index.js:49`, `routes/products.js:36`, `routes/services.js:36` используют `HAS_MONGO` вместо `hasMongo()` (факт доступности соединения).
- **Impact:** при отвале БД — каскад 500 вместо graceful 503.
- **Reproduction:** не воспроизведено (нужно имитировать отвал БД).
- **Recommended fix:** использовать `hasMongo()` или `req.dbConnected` везде.

**M2. Нет пагинации на ключевых страницах**
- **Evidence:** `routes/index.js:153-154`, `routes/products.js:86-87`, `routes/services.js:86-87`, `routes/admin.js:49-90` — `find()` без `limit/skip`.
- **Impact:** деградация при росте данных.
- **Recommended fix:** добавить pagination и `.lean()`.

**M3. Запись статистики и подсчёт пользователей на каждом page view**
- **Evidence:** `routes/index.js:156-161`, `routes/products.js:89-94`, `routes/services.js:89-94`, `routes/about.js:54-59`, `routes/ad.js:47-52`, `routes/admin.js:126-132`.
- **Impact:** лишние записи/сканы; нагрузка на БД.
- **Recommended fix:** кэш/агрегация, перенос в фон.

**M4. `/api/instagram/oembed` без таймаута**
- **Evidence:** `routes/api.js:118` использует `https.get` без timeout.
- **Impact:** зависание воркеров при проблемах API.
- **Recommended fix:** задать `timeout` и `AbortController`/`setTimeout`.

**M5. Origin‑check зависит от `BASE_URL`**
- **Evidence:** `config/app.js:108-131`.
- **Impact:** неверный `BASE_URL` → блок всех unsafe запросов.
- **Recommended fix:** валидировать `BASE_URL`, добавить fallback/логирование.

**M6. `config/session.js` зависит от `./redis`, которого нет**
- **Evidence:** `config/session.js:6` требует `./redis`, файла нет (`Test-Path config/redis.js` → False).
- **Impact:** потенциальный краш при использовании `config/session.js`.
- **Recommended fix:** удалить/исправить зависимость или добавить модуль.

### Low

**L1. Нет транзакционности Cloudinary/FS vs MongoDB**
- **Evidence:** множественные удаления в `routes/admin.js`, `routes/cabinet.js`, `services/productService.js` без транзакций.
- **Impact:** частичные удаления при сбоях.

**L2. `morgan("dev")` включён в проде**
- **Evidence:** `config/app.js:52`.
- **Impact:** лишний шум в логах и небольшая нагрузка.

**L3. GET `/api/comments/:cardId` не проверяет статус карточки**
- **Evidence:** `routes/comments.js:34-60` — нет проверки `status`.
- **Impact:** можно читать комментарии к pending карточкам.

## 4) Dev/Prod Parity Risks
- Vercel без сессий: `req.session` не доступен → падение защищённых API.
- Vercel CSRF: токен не выдаётся → 403 для всех небезопасных API.
- Socket.IO отключён в Vercel: часть UI/функций чата недоступна (`server.js:17`).
- Upload fallback на локальный FS в Vercel → потеря файлов при перезапусках (`utils/upload.js:97-117`).
- `BASE_URL` критичен для Origin‑check и email‑ссылок (`config/app.js:108-131`, `services/emailVerificationService.js`).

## 5) Dynamic Test Results

### Запуск / локальный режим (уже работающий сервер на 3002)
- `GET /` → 200
- `GET /products` → 200
- `GET /services` → 200
- `GET /about` → 200
- `GET /contacts` → 200
- `GET /ad` → 200
- `GET /user/login` → 200
- `GET /admin/login` → 200
- `GET /health` → 200
- `GET /__health/cloudinary` → 200 (ответ содержит `public_id`, `secure_url` → подтверждён upload)
- `GET /api/products` → 200
- `GET /api/services` → 200
- `GET /api/banners` → 200
- `GET /api/contacts` → 200
- `GET /api/categories/tree` → 200
- `GET /api/categories/flat` → 200
- `GET /admin` (unauth) → 302
- `GET /cabinet` (unauth) → 302
- `POST /api/services` (unauth) → 403

### CSRF chain (обычный режим)
```
# Получение CSRF из /user/login
NORMAL_MODE_CSRF_TOKEN_PRESENT=True

# POST без CSRF
NORMAL_MODE_CSRF_MISSING_STATUS=403

# POST с CSRF (валидный токен, валидный ObjectId, но ресурс не найден)
NORMAL_MODE_CSRF_PRESENT_STATUS=404
```

### Vercel‑mode (симуляция)
- Запуск: `$env:VERCEL='1'; $env:NODE_ENV='production'; $env:PORT='3005'; node server.js`
- `GET /user/login` → `_csrf` пустой (`VERCEL_MODE_CSRF_TOKEN_VALUE=''`)
- `POST /api/banners/:id/vote` без токена → 403
- Попытка использовать синтетический CSRF‑токен (cookie `_csrf` + header) → 403

**Вывод:** CSRF‑цепочка в Vercel неработоспособна.

## 6) Security Checklist
- CSRF: **FAIL** (Vercel токен не выдаётся, API требует токен).
- AuthZ: частично OK, но API опирается на `req.session` → **FAIL** в Vercel.
- Rate‑limit: `loginLimiter` не используется → **FAIL**.
- Secrets handling: секреты логируются → **FAIL**.
- SSRF/timeout: `instagram/oembed` без таймаута → **WARN**.
- Upload limits: лимиты есть (5MB/5 файлов) → **OK**, но Vercel FS ephemeral → **WARN**.

## 7) Performance Checklist
- Pagination: отсутствует на ключевых страницах → **FAIL**.
- Heavy queries: массовые `find()` без лимитов → **WARN**.
- Writes per view: `Statistics.findOneAndUpdate` на каждом view → **WARN**.
- Caching: отсутствует → **WARN**.

## 8) Open Questions / Not Verified
- Не проверены защищённые маршруты с реальной авторизацией (нет учёток).
- Не проверены upload‑маршруты с файлами (чтобы избежать изменения данных).
- Не проверены сценарии реального падения БД/Cloudinary/SMTP.
- Не проверены конкурентные запросы и гонки.

## 9) Appendix

### Команды запуска
- Обычный режим: `node server.js`
- Vercel‑mode: `$env:VERCEL='1'; $env:NODE_ENV='production'; $env:PORT='3005'; node server.js`

### Middleware Map (ключевые)
- Security headers: `config/security.js` (`helmet`)
- Parsing: `config/app.js` (`express.json`, `express.urlencoded`, `cookie-parser`)
- Session: `config/app.js` (только non‑Vercel)
- CSRF: `config/app.js` (non‑Vercel), `routes/api.js` (всегда)
- Auth: `middleware/auth.js` (`requireUser`, `requireAdmin`)
- Rate‑limit: `middleware/rateLimiter.js` (`apiLimiter`, `productLimiter`, `loginLimiter`)
- Upload: `utils/upload.js`
- Validation: `middleware/validators.js`

### Конфиги/флаги
- `NODE_ENV`, `VERCEL`, `BASE_URL`, `FRONTEND_URL`, `MONGODB_URI`, `SESSION_SECRET`, `JWT_SECRET`, `SMTP_*`, `CLOUDINARY_*`

---

## Production Readiness Checklist (блокеры)
1) Исправить CSRF в Vercel (токен должен выдаваться и приниматься API).
2) Убрать `req.session` из API или включить session middleware в Vercel.
3) Удалить логирование секретов.
4) Закрыть `/__health/cloudinary`.
5) Включить `loginLimiter` на login маршрутах.
6) Добавить CSRF‑проверку для admin‑contacts.
7) Ввести пагинацию/лимиты для массовых запросов.

## Optimization Opportunities (без внедрения)
- Пагинация на `/`, `/products`, `/services`, `/admin/*`.
- Кэширование статистики/`User.countDocuments()`.
- Таймауты и ретраи для внешних API.
- Гигиена логов (секреты + verbosity).

