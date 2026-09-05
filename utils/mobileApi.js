function requestFullPath(req) {
  const candidates = [
    req && req.originalUrl,
    req && req.baseUrl != null ? `${req.baseUrl}${req.path || ""}` : "",
    req && req.url,
    req && req.path
  ];

  let fallback = "/";
  for (const candidate of candidates) {
    const raw = String(candidate || "").split("?")[0].trim();
    if (!raw) continue;
    const normalized = raw.replace(/\/+$/, "") || "/";
    if (normalized.includes("/api/mobile")) return normalized;
    if (fallback === "/") fallback = normalized;
  }
  return fallback;
}

function isMobileApiPath(req) {
  const path = requestFullPath(req);
  if (path === "/api/mobile" || path.startsWith("/api/mobile/")) return true;
  const url = String((req && (req.originalUrl || req.url)) || "");
  return /(?:^|\/)api\/mobile(?:\/|\?|$)/.test(url);
}

function shouldSkipCsrf(req) {
  return isMobileApiPath(req);
}

function shouldSkipOriginCheck(req) {
  return isMobileApiPath(req);
}

module.exports = {
  requestFullPath,
  isMobileApiPath,
  shouldSkipCsrf,
  shouldSkipOriginCheck
};
