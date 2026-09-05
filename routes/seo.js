const express = require("express");
const router = express.Router();

const { Op } = require("sequelize");
const Product = require("../config/database").Product;
const { USE_POSTGRES } = require("../config/database");
const { publicProductWhere, notDeletedClause } = require("../utils/catalogFilters");
const { getPublicOrigin } = require("../utils/siteUrl");
const { buildSitemapXml, buildRobotsTxt } = require("../services/sitemapService");

function isPrivatePath(pathname) {
  return /^\/(admin|cabinet|api|login|register|health|__health)(\/|$)/.test(pathname)
    || pathname === "/user/login";
}

router.use((req, res, next) => {
  if (isPrivatePath(req.path)) {
    res.set("X-Robots-Tag", "noindex, nofollow");
  }
  res.locals.siteOrigin = getPublicOrigin(req);
  next();
});

router.get("/robots.txt", (req, res) => {
  const body = buildRobotsTxt(getPublicOrigin(req));
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(body);
});

router.get("/sitemap.xml", async (req, res) => {
  const origin = getPublicOrigin(req);
  let productCount = 0;
  let lastmod = new Date();

  if (USE_POSTGRES) {
    try {
      const [count, latest] = await Promise.all([
        Product.count({ where: publicProductWhere() }),
        Product.findOne({
          where: {
            [Op.and]: [
              { status: "approved" },
              notDeletedClause()
            ]
          },
          order: [["updatedAt", "DESC"]],
          attributes: ["updatedAt"]
        })
      ]);
      productCount = count || 0;
      if (latest && latest.updatedAt) lastmod = latest.updatedAt;
    } catch (err) {
      console.warn("sitemap: catalog lookup failed:", err && err.message ? err.message : err);
    }
  }

  const xml = buildSitemapXml({ origin, productCount, lastmod });
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

module.exports = router;
