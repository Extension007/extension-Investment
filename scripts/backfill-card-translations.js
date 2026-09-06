#!/usr/bin/env node
"use strict";

/**
 * Backfill translations for existing product cards that have empty/incomplete
 * translations JSON. Safe to re-run: skips cards that already have all 4 locales.
 *
 * Usage:
 *   node scripts/backfill-card-translations.js
 *   node scripts/backfill-card-translations.js --force
 *   node scripts/backfill-card-translations.js --limit=20
 *   node scripts/backfill-card-translations.js --dry-run
 */
require("dotenv").config();

const { Client } = require("pg");
const {
  SUPPORTED_LOCALES,
  buildCardTranslations
} = require("../services/cardTranslationService");

function cleanEnvUrl(value) {
  return String(value || "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

function parseArgs(argv) {
  const opts = { force: false, dryRun: false, limit: 0, delayMs: 450 };
  for (const arg of argv.slice(2)) {
    if (arg === "--force") opts.force = true;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--limit=")) opts.limit = Math.max(0, parseInt(arg.slice(8), 10) || 0);
    else if (arg.startsWith("--delay=")) opts.delayMs = Math.max(0, parseInt(arg.slice(8), 10) || 0);
  }
  return opts;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasCompleteTranslations(translations) {
  if (!translations || typeof translations !== "object") return false;
  return SUPPORTED_LOCALES.every((locale) => {
    const block = translations[locale];
    return block && typeof block === "object" && String(block.name || "").trim() !== "";
  });
}

/** Guess source language for old cards that defaulted to "en". */
function detectSourceLocale(product) {
  const current = String(product.source_locale || "").toLowerCase();
  if (SUPPORTED_LOCALES.includes(current) && current !== "en") {
    return current;
  }
  const sample = `${product.name || ""} ${product.description || ""} ${product.price || ""}`;
  if (/[\u4e00-\u9fff]/.test(sample)) return "zh";
  if (/[ӘәІіҢңҒғҮүҰұҚқӨөҺһ]/.test(sample)) return "kk";
  if (/[А-Яа-яЁё]/.test(sample)) return "ru";
  if (SUPPORTED_LOCALES.includes(current)) return current;
  return "en";
}

async function main() {
  const opts = parseArgs(process.argv);
  const url = cleanEnvUrl(process.env.DATABASE_URL);
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const useSsl =
    process.env.DATABASE_SSL === "true" ||
    url.includes("sslmode=require") ||
    url.includes("neon.tech");

  const client = new Client({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : false
  });
  await client.connect();

  let sql = `
    SELECT id, name, description, price, tags, contacts, source_locale, translations
    FROM products
    WHERE deleted = false
  `;
  if (!opts.force) {
    sql += `
      AND (
        translations IS NULL
        OR translations = '{}'::jsonb
        OR (SELECT count(*) FROM jsonb_object_keys(COALESCE(translations, '{}'::jsonb))) < ${SUPPORTED_LOCALES.length}
      )
    `;
  }
  sql += ` ORDER BY id ASC`;
  if (opts.limit > 0) sql += ` LIMIT ${opts.limit}`;

  const { rows: products } = await client.query(sql);
  console.log(
    `Found ${products.length} card(s) to translate` +
      (opts.force ? " (force)" : " (missing/incomplete)") +
      (opts.dryRun ? " [dry-run]" : "")
  );

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const product of products) {
    if (!opts.force && hasCompleteTranslations(product.translations)) {
      skipped += 1;
      continue;
    }

    const sourceLocale = detectSourceLocale(product);
    const contacts =
      product.contacts && typeof product.contacts === "object" ? product.contacts : {};

    process.stdout.write(`#${product.id} "${String(product.name || "").slice(0, 40)}" [${sourceLocale}] … `);

    try {
      const built = await buildCardTranslations(
        {
          name: product.name,
          description: product.description,
          price: product.price,
          tags: product.tags,
          contact_method: contacts.contact_method || ""
        },
        sourceLocale
      );

      if (opts.dryRun) {
        console.log(`ok (would save ${Object.keys(built.translations).join(",")})`);
        ok += 1;
      } else {
        await client.query(
          `UPDATE products
           SET source_locale = $1,
               translations = $2::jsonb,
               updated_at = NOW()
           WHERE id = $3`,
          [sourceLocale, JSON.stringify(built.translations), product.id]
        );
        console.log(`saved (${built.provider})`);
        ok += 1;
      }
    } catch (err) {
      failed += 1;
      console.log(`FAIL: ${err.message}`);
    }

    if (opts.delayMs > 0) await sleep(opts.delayMs);
  }

  console.log(`Done. ok=${ok} skipped=${skipped} failed=${failed}`);
  await client.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("backfill-card-translations failed:", err.message);
  process.exit(1);
});
