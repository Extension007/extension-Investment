'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products");

    if (!table.country) {
      await queryInterface.addColumn("products", "country", {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: ""
      });
    }
    if (!table.region) {
      await queryInterface.addColumn("products", "region", {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: ""
      });
    }
    if (!table.city) {
      await queryInterface.addColumn("products", "city", {
        type: Sequelize.STRING(100),
        allowNull: true,
        defaultValue: ""
      });
    }
    if (!table.tags) {
      await queryInterface.addColumn("products", "tags", {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: true,
        defaultValue: []
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS products_location_idx
        ON products (country, region, city);
      CREATE INDEX IF NOT EXISTS products_tags_gin_idx
        ON products USING GIN (tags);
    `);

    try {
      await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS products_name_trgm_idx
          ON products USING GIN (name gin_trgm_ops);
      `);
    } catch (_) {
      /* optional */
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("products");
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS products_name_trgm_idx;
      DROP INDEX IF EXISTS products_tags_gin_idx;
      DROP INDEX IF EXISTS products_location_idx;
    `);
    if (table.tags) await queryInterface.removeColumn("products", "tags");
    if (table.city) await queryInterface.removeColumn("products", "city");
    if (table.region) await queryInterface.removeColumn("products", "region");
    if (table.country) await queryInterface.removeColumn("products", "country");
  }
};
