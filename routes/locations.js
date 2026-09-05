const express = require("express");
const router = express.Router();
const { getCountries, getRegions, getCities, LOCATIONS } = require("../data/locations");
const { USE_POSTGRES, sequelize } = require("../config/database");

router.get("/countries", (req, res) => {
  res.json({ success: true, countries: getCountries(req.locale) });
});

router.get("/regions", (req, res) => {
  const country = String(req.query.country || "").trim();
  if (!country) {
    return res.status(400).json({ success: false, message: "country required" });
  }
  res.json({ success: true, regions: getRegions(country, req.locale) });
});

router.get("/cities", (req, res) => {
  const country = String(req.query.country || "").trim();
  if (!country) {
    return res.status(400).json({ success: false, message: "country required" });
  }
  res.json({ success: true, cities: getCities(country, "", req.locale) });
});

router.get("/tree", (req, res) => {
  res.json({
    success: true,
    locations: LOCATIONS.map((c) => ({
      code: c.code,
      value: c.value,
      label: c.name[req.locale] || c.name.en,
      regions: c.regions.map((r) => ({
        code: r.code,
        value: r.value,
        label: r.name[req.locale] || r.name.en,
        cities: r.cities.map((city) => ({
          code: city.code,
          value: city.value,
          label: city.name[req.locale] || city.name.en
        }))
      }))
    }))
  });
});

router.get("/suggest-tags", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase().replace(/^#/, "");
    if (!USE_POSTGRES) {
      return res.json({ success: true, tags: [] });
    }
    if (!q || q.length < 1) {
      const [rows] = await sequelize.query(`
        SELECT tag, COUNT(*)::int AS cnt
        FROM products, unnest(COALESCE(tags, '{}')) AS tag
        WHERE status = 'approved' AND (deleted IS NULL OR deleted = false)
          AND (expires_at IS NULL OR expires_at > NOW())
        GROUP BY tag
        ORDER BY cnt DESC, tag ASC
        LIMIT 12
      `);
      return res.json({ success: true, tags: rows.map((r) => r.tag) });
    }

    const [rows] = await sequelize.query(
      `
      SELECT tag, COUNT(*)::int AS cnt
      FROM products, unnest(COALESCE(tags, '{}')) AS tag
      WHERE status = 'approved'
        AND (deleted IS NULL OR deleted = false)
        AND (expires_at IS NULL OR expires_at > NOW())
        AND tag ILIKE :pattern
      GROUP BY tag
      ORDER BY cnt DESC, tag ASC
      LIMIT 12
      `,
      { replacements: { pattern: `${q}%` } }
    );
    res.json({ success: true, tags: rows.map((r) => r.tag) });
  } catch (err) {
    console.error("suggest-tags:", err.message);
    res.status(500).json({ success: false, message: "Ошибка подсказок", tags: [] });
  }
});

module.exports = router;
