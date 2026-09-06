"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("products").catch(() => null);
    if (!table) return;
    if (!table.currency) {
      await queryInterface.addColumn("products", "currency", {
        type: Sequelize.STRING(8),
        allowNull: false,
        defaultValue: "KZT"
      });
    }
    if (!table.source_locale && !table.sourceLocale) {
      await queryInterface.addColumn("products", "source_locale", {
        type: Sequelize.STRING(8),
        allowNull: false,
        defaultValue: "en"
      });
    }
    if (!table.translations) {
      await queryInterface.addColumn("products", "translations", {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {}
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("products").catch(() => null);
    if (!table) return;
    if (table.translations) await queryInterface.removeColumn("products", "translations");
    if (table.source_locale) await queryInterface.removeColumn("products", "source_locale");
    if (table.currency) await queryInterface.removeColumn("products", "currency");
  }
};
