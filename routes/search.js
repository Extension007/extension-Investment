const express = require("express");
const router = express.Router();
const { Product, USE_POSTGRES, sequelize, Op } = require("../config/database");
const { publicProductWhere, publicServiceWhere } = require("../utils/catalogFilters");
const { Sequelize } = require("sequelize");

router.get("/suggest", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!USE_POSTGRES) {
      return res.json({ success: true, suggestions: [] });
    }
    if (!q || q.length < 2) {
      return res.json({ success: true, suggestions: [] });
    }

    const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
    const baseProduct = publicProductWhere();
    const baseService = publicServiceWhere();

    const [products, tagRows] = await Promise.all([
      Product.findAll({
        where: {
          [Op.and]: [
            { [Op.or]: [baseProduct, baseService] },
            {
              [Op.or]: [
                { name: { [Op.iLike]: pattern } },
                { description: { [Op.iLike]: pattern } }
              ]
            }
          ]
        },
        attributes: ["id", "name", "type", "tags"],
        order: [["id", "DESC"]],
        limit: 8
      }),
      sequelize.query(
        `
        SELECT tag, COUNT(*)::int AS cnt
        FROM products, unnest(COALESCE(tags, '{}')) AS tag
        WHERE status = 'approved'
          AND (deleted IS NULL OR deleted = false)
          AND (expires_at IS NULL OR expires_at > NOW())
          AND tag ILIKE :pattern
        GROUP BY tag
        ORDER BY cnt DESC, tag ASC
        LIMIT 8
        `,
        { replacements: { pattern: `${q.toLowerCase().replace(/^#/, "")}%` } }
      )
    ]);

    const tags = (tagRows[0] || []).map((r) => ({
      type: "tag",
      value: r.tag,
      label: `#${r.tag}`
    }));

    const titles = products.map((p) => ({
      type: "title",
      value: p.name,
      label: p.name,
      id: p.id,
      cardType: p.type
    }));

    res.json({
      success: true,
      suggestions: [...tags, ...titles].slice(0, 12)
    });
  } catch (err) {
    console.error("search suggest:", err.message);
    res.status(500).json({ success: false, suggestions: [], message: err.message });
  }
});

module.exports = router;
