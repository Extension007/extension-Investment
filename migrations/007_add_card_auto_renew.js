'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products");
    if (!table.auto_renew) {
      await queryInterface.addColumn("products", "auto_renew", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS products_auto_renew_expires_idx
        ON products (auto_renew, expires_at);
    `);
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("products");
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS products_auto_renew_expires_idx;`);
    if (table.auto_renew) await queryInterface.removeColumn("products", "auto_renew");
  }
};
