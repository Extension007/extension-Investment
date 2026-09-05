'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products");

    if (!table.published_at) {
      await queryInterface.addColumn("products", "published_at", {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!table.expires_at) {
      await queryInterface.addColumn("products", "expires_at", {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
    if (!table.edit_until) {
      await queryInterface.addColumn("products", "edit_until", {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS products_expires_at_idx ON products (expires_at);
    `);

    await queryInterface.sequelize.query(`
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
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("products");
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS products_expires_at_idx;`);
    if (table.edit_until) await queryInterface.removeColumn("products", "edit_until");
    if (table.expires_at) await queryInterface.removeColumn("products", "expires_at");
    if (table.published_at) await queryInterface.removeColumn("products", "published_at");
  }
};
