'use strict';

const { Op, Sequelize } = require("sequelize");

function parseTags(input) {
  if (Array.isArray(input)) {
    return normalizeTagList(input);
  }
  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) return [];
    try {
      if (raw.startsWith("[")) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return normalizeTagList(parsed);
      }
    } catch (_) {
      /* fall through */
    }
    return normalizeTagList(raw.split(/[,#\n]+/));
  }
  return [];
}

function normalizeTagList(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    let tag = String(item || "")
      .trim()
      .replace(/^#+/, "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-zа-яёәіңғүұқөһ0-9\u4e00-\u9fff\-_]/gi, "")
      .slice(0, 40);
    if (!tag || tag.length < 2) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= 15) break;
  }
  return out;
}

function parsePriceNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Build Sequelize where extras from catalog query params.
 * @param {object} query
 * @returns {{ extras: object[], order: array, meta: object }}
 */
function buildCatalogFilters(query = {}) {
  const extras = [];
  const meta = {
    q: "",
    country: "",
    city: "",
    tag: "",
    priceMin: "",
    priceMax: "",
    category: query.category || "all"
  };

  const q = String(query.q || query.search || "").trim();
  if (q) {
    meta.q = q.slice(0, 120);
    extras.push(buildFullTextClause(meta.q));
  }

  const country = String(query.country || "").trim();
  const city = String(query.city || "").trim();
  if (country) {
    meta.country = country.slice(0, 100);
    extras.push({ country: meta.country });
  }
  if (city) {
    meta.city = city.slice(0, 100);
    extras.push({ city: meta.city });
  }

  const tag = String(query.tag || "").trim().replace(/^#/, "").toLowerCase();
  if (tag) {
    meta.tag = tag.slice(0, 40);
    extras.push(
      Sequelize.where(
        Sequelize.fn(
          "COALESCE",
          Sequelize.col("tags"),
          Sequelize.literal("'{}'::text[]")
        ),
        { [Op.contains]: [meta.tag] }
      )
    );
  }

  const priceMin = parsePriceNumber(query.priceMin);
  const priceMax = parsePriceNumber(query.priceMax);
  if (priceMin != null) meta.priceMin = String(priceMin);
  if (priceMax != null) meta.priceMax = String(priceMax);
  if (priceMin != null || priceMax != null) {
    // price is stored as STRING — extract leading number for comparison when possible
    const parts = [];
    if (priceMin != null) {
      parts.push(
        Sequelize.where(
          Sequelize.literal(
            `NULLIF(regexp_replace(COALESCE(price, ''), '[^0-9.,]', '', 'g'), '')::numeric`
          ),
          { [Op.gte]: priceMin }
        )
      );
    }
    if (priceMax != null) {
      parts.push(
        Sequelize.where(
          Sequelize.literal(
            `NULLIF(regexp_replace(COALESCE(price, ''), '[^0-9.,]', '', 'g'), '')::numeric`
          ),
          { [Op.lte]: priceMax }
        )
      );
    }
    extras.push({ [Op.and]: parts });
  }

  const order = q
    ? [[Sequelize.literal("id"), "DESC"]]
    : [["id", "DESC"]];

  return { extras, order, meta };
}

function escapeSqlLiteral(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function buildFullTextClause(q) {
  const pattern = `%${q.replace(/[%_]/g, "\\$&")}%`;
  const or = [
    { name: { [Op.iLike]: pattern } },
    { description: { [Op.iLike]: pattern } },
    Sequelize.where(
      Sequelize.fn(
        "array_to_string",
        Sequelize.fn("COALESCE", Sequelize.col("tags"), Sequelize.literal("'{}'::text[]")),
        " "
      ),
      { [Op.iLike]: pattern }
    ),
    Sequelize.literal(
      `to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(array_to_string(tags, ' '), '')) @@ plainto_tsquery('simple', ${escapeSqlLiteral(q)})`
    )
  ];

  return { [Op.or]: or };
}

function mergeWhere(baseWhere, extras) {
  if (!extras || !extras.length) return baseWhere;
  const and = [];
  if (baseWhere && baseWhere[Op.and]) {
    and.push(...baseWhere[Op.and]);
    const rest = { ...baseWhere };
    delete rest[Op.and];
    if (Object.keys(rest).length) and.push(rest);
  } else if (baseWhere && Object.keys(baseWhere).length) {
    and.push(baseWhere);
  }
  and.push(...extras);
  return { [Op.and]: and };
}

function formatLocation(product) {
  const parts = [product.city, product.country].filter(Boolean);
  return parts.join(", ");
}

module.exports = {
  parseTags,
  normalizeTagList,
  buildCatalogFilters,
  mergeWhere,
  formatLocation,
  buildFullTextClause
};
