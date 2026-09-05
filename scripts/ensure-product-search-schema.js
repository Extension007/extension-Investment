'use strict';

/**
 * Idempotent schema upgrade for location, tags, and search indexes.
 * Safe for local + Neon/production.
 */
require("dotenv").config();
const { Client } = require("pg");

async function ensureProductSearchSchema(client) {
  await client.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS region VARCHAR(100) DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS city VARCHAR(100) DEFAULT '';
    ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS products_location_idx
      ON products (country, region, city);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS products_tags_gin_idx
      ON products USING GIN (tags);
  `);
  // Name trigram optional — skip if extension missing; ILIKE + tags GIN is enough
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await client.query(`
      CREATE INDEX IF NOT EXISTS products_name_trgm_idx
        ON products USING GIN (name gin_trgm_ops);
    `);
  } catch (err) {
    console.warn("⚠️ pg_trgm index skipped:", err.message);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }

  const ssl =
    process.env.DATABASE_SSL === "true" ||
    process.env.DATABASE_URL.includes("sslmode=require") ||
    process.env.DATABASE_URL.includes("neon.tech");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: ssl ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" } : false
  });

  try {
    await client.connect();
    await ensureProductSearchSchema(client);
    console.log("✅ products: country/region/city/tags + indexes ready");
  } catch (err) {
    console.error("❌ ensure-product-search-schema:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = { ensureProductSearchSchema };
