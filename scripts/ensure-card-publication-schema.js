'use strict';

/**
 * Idempotent schema upgrade for publication lifetime fields.
 */
require("dotenv").config();

async function ensureCardPublicationSchema(sequelizeOrClient) {
  const query = typeof sequelizeOrClient.query === "function"
    ? (sql) => sequelizeOrClient.query(sql)
    : (sql) => sequelizeOrClient.query(sql);

  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;`);
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;`);
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS edit_until TIMESTAMPTZ NULL;`);
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT FALSE;`);
  await query(`CREATE INDEX IF NOT EXISTS products_expires_at_idx ON products (expires_at);`);
  await query(`CREATE INDEX IF NOT EXISTS products_auto_renew_expires_idx ON products (auto_renew, expires_at);`);
  await query(`
    UPDATE products
    SET
      published_at = NOW(),
      expires_at = CASE
        WHEN COALESCE(tier, 'free') = 'paid' THEN NOW() + INTERVAL '1 month'
        ELSE NOW() + INTERVAL '7 days'
      END,
      edit_until = NOW() + INTERVAL '24 hours'
      WHERE status = 'approved'
        AND (deleted IS NULL OR deleted = false)
        AND expires_at IS NULL;
  `);
  await query(`
    UPDATE products
    SET edit_until = published_at + INTERVAL '24 hours'
    WHERE status = 'approved'
      AND (deleted IS NULL OR deleted = false)
      AND published_at IS NOT NULL
      AND (edit_until IS NULL OR edit_until <= published_at + INTERVAL '1 minute');
  `);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL не задан");
    process.exit(1);
  }
  const { sequelize } = require("../config/database");
  try {
    await sequelize.authenticate();
    await ensureCardPublicationSchema(sequelize);
    console.log("✅ products: published_at / expires_at / edit_until ready");
  } catch (err) {
    console.error("❌ ensure-card-publication-schema:", err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

if (require.main === module) {
  main();
}

module.exports = { ensureCardPublicationSchema };
