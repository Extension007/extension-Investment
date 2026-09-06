#!/usr/bin/env node
"use strict";

const { Client } = require("pg");

async function ensureProductCurrencyAndTranslationsSchema(client) {
  await client.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'KZT'
  `);
  await client.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS source_locale VARCHAR(8) NOT NULL DEFAULT 'en'
  `);
  await client.query(`
    ALTER TABLE products
    ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb
  `);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl:
      process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true"
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    await ensureProductCurrencyAndTranslationsSchema(client);
    console.log("✅ products.currency / source_locale / translations ready");
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("❌ ensure-product-currency-schema:", err.message);
    process.exit(1);
  });
}

module.exports = { ensureProductCurrencyAndTranslationsSchema };
