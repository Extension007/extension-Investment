const CANONICAL_ORIGIN = "https://www.albamount.xyz";

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    return new URL(value).origin;
  } catch (_) {
    const trimmed = String(value).trim().replace(/\/+$/, "");
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return "";
  }
}

function getPublicOrigin(req) {
  const fromEnv = normalizeOrigin(process.env.BASE_URL || process.env.PUBLIC_URL || "");
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return CANONICAL_ORIGIN;
  }

  if (req) {
    const host = String(req.get("x-forwarded-host") || req.get("host") || "")
      .split(",")[0]
      .trim();
    if (host) {
      const proto = String(req.get("x-forwarded-proto") || req.protocol || "http")
        .split(",")[0]
        .trim() || "http";
      return `${proto}://${host.replace(/\/+$/, "")}`;
    }
  }

  return CANONICAL_ORIGIN;
}

function absoluteUrl(pathname, req) {
  const origin = getPublicOrigin(req).replace(/\/+$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return origin + path;
}

module.exports = {
  CANONICAL_ORIGIN,
  getPublicOrigin,
  absoluteUrl
};
