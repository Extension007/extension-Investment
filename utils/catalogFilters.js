const { Op } = require("sequelize");
const { livePublicationClause, LIVE_PUBLICATION_SQL } = require("./cardPublication");

function notDeletedClause() {
  return { [Op.or]: [{ deleted: false }, { deleted: { [Op.is]: null } }] };
}

function publicProductWhere(extra) {
  const and = [
    { status: "approved" },
    { [Op.or]: [{ type: "product" }, { type: null }] },
    notDeletedClause(),
    livePublicationClause()
  ];
  if (extra && Object.keys(extra).length) and.push(extra);
  return { [Op.and]: and };
}

function publicServiceWhere(extra) {
  const and = [
    { status: "approved" },
    { type: "service" },
    notDeletedClause(),
    livePublicationClause()
  ];
  if (extra && Object.keys(extra).length) and.push(extra);
  return { [Op.and]: and };
}

module.exports = {
  notDeletedClause,
  publicProductWhere,
  publicServiceWhere,
  LIVE_PUBLICATION_SQL
};
