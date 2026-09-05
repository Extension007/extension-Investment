const csrf = require('csurf');

function csrfCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    path: '/'
  };
}

function firstString(value) {
  if (Array.isArray(value)) return firstString(value[0]);
  return typeof value === 'string' ? value.trim() : '';
}

function isMultipartRequest(req) {
  const type = typeof req.get === 'function'
    ? req.get('content-type')
    : (req.headers && req.headers['content-type']);
  return /multipart\/form-data/i.test(String(type || ''));
}

function requestPath(req) {
  const raw = String((req && req.path) || (req && req.url) || '').split('?')[0];
  return raw.replace(/\/+$/, '') || '/';
}

const DEFERRED_MULTIPART_PATHS = [
  /^\/cabinet\/product$/,
  /^\/cabinet\/product\/[^/]+\/edit$/,
  /^\/admin\/products\/[^/]+\/edit$/,
  /^\/admin\/services\/[^/]+\/edit$/
];

function readCsrfToken(req) {
  const bodyToken = firstString(req.body && req.body._csrf);
  if (bodyToken) return bodyToken;

  const queryToken = firstString(req.query && req.query._csrf);
  if (queryToken) return queryToken;

  const headers = req.headers || {};
  const headerToken = firstString(
    headers['csrf-token'] ||
    headers['xsrf-token'] ||
    headers['x-csrf-token'] ||
    headers['x-xsrf-token']
  );
  if (headerToken) return headerToken;

  if (typeof req.get === 'function') {
    return firstString(
      req.get('csrf-token') ||
      req.get('xsrf-token') ||
      req.get('x-csrf-token') ||
      req.get('x-xsrf-token')
    );
  }
  return '';
}

function shouldDeferMultipartCsrf(req) {
  if (!isMultipartRequest(req)) return false;
  if (readCsrfToken({ headers: req.headers || {}, body: {}, query: {} })) return false;
  return DEFERRED_MULTIPART_PATHS.some((re) => re.test(requestPath(req)));
}

const csrfProtection = csrf({
  cookie: csrfCookieOptions(),
  value: readCsrfToken
});

// Multipart bodies are not parsed until multer. Global csurf therefore cannot see
// hidden _csrf on native form posts. Defer only those upload routes that verify
// again after multer — never skip CSRF for login/logout/API.
function globalCsrfProtection(req, res, next) {
  if (shouldDeferMultipartCsrf(req)) {
    return next();
  }
  return csrfProtection(req, res, next);
}

function csrfToken(req, res, next) {
  if (typeof req.csrfToken === 'function') {
    res.locals.csrfToken = req.csrfToken();
  } else {
    res.locals.csrfToken = '';
  }
  next();
}

module.exports = {
  csrfToken,
  csrfProtection,
  globalCsrfProtection,
  csrfCookieOptions,
  isMultipartRequest,
  readCsrfToken,
  shouldDeferMultipartCsrf,
  requestPath
};
