const CATALOG_PAGE_SIZE = 24;
const MAX_PAGES = 50;

function xmlEscape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toLastmod(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function urlEntry(loc, { lastmod, changefreq, priority } = {}) {
  const parts = ["  <url>", `    <loc>${xmlEscape(loc)}</loc>`];
  const stamp = toLastmod(lastmod);
  if (stamp) parts.push(`    <lastmod>${stamp}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${xmlEscape(changefreq)}</changefreq>`);
  if (priority) parts.push(`    <priority>${xmlEscape(priority)}</priority>`);
  parts.push("  </url>");
  return parts.join("\n");
}

function pageCount(total, pageSize = CATALOG_PAGE_SIZE) {
  const n = Number(total) || 0;
  if (n <= 0) return 1;
  return Math.min(MAX_PAGES, Math.max(1, Math.ceil(n / pageSize)));
}

function buildSitemapXml({
  origin,
  productCount = 0,
  lastmod,
  pageSize = CATALOG_PAGE_SIZE
} = {}) {
  const base = String(origin || "").replace(/\/+$/, "");
  const urls = [
    urlEntry(`${base}/`, { lastmod, changefreq: "daily", priority: "1.0" }),
    urlEntry(`${base}/ad`, { lastmod, changefreq: "daily", priority: "0.9" }),
    urlEntry(`${base}/services`, { lastmod, changefreq: "daily", priority: "0.8" }),
    urlEntry(`${base}/contacts`, { changefreq: "monthly", priority: "0.5" }),
    urlEntry(`${base}/faq`, { changefreq: "monthly", priority: "0.6" }),
    urlEntry(`${base}/privacy`, { changefreq: "yearly", priority: "0.4" }),
    urlEntry(`${base}/terms`, { changefreq: "yearly", priority: "0.4" }),
    urlEntry(`${base}/rules`, { changefreq: "monthly", priority: "0.5" })
  ];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls.join("\n"),
    "</urlset>",
    ""
  ].join("\n");
}

function buildRobotsTxt(origin) {
  const base = String(origin || "").replace(/\/+$/, "");
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /admin/",
    "Disallow: /cabinet",
    "Disallow: /cabinet/",
    "Disallow: /app",
    "Disallow: /download",
    "Disallow: /get-app",
    "Disallow: /api/",
    "Disallow: /login",
    "Disallow: /user/login",
    "Disallow: /health",
    "Disallow: /__health/",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    ""
  ].join("\n");
}

module.exports = {
  CATALOG_PAGE_SIZE,
  MAX_PAGES,
  xmlEscape,
  toLastmod,
  pageCount,
  buildSitemapXml,
  buildRobotsTxt
};
