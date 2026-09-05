const { Op } = require("sequelize");
const Product = require("../models/Product");
const Comment = require("../models/Comment");
const { ChatRead } = require("../config/database");
const { countUnreadComments } = require("../utils/chatUnread");

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function notDeletedCard() {
  return { [Op.or]: [{ deleted: false }, { deleted: { [Op.is]: null } }] };
}

async function getWatchedCardIds(userId) {
  const uid = toPositiveInt(userId);
  if (!uid) return [];
  const [owned, written] = await Promise.all([
    Product.findAll({
      where: {
        ownerId: uid,
        ...notDeletedCard()
      },
      attributes: ["id"]
    }),
    Comment.findAll({
      where: { userId: uid, deleted: false },
      attributes: ["cardId"]
    })
  ]);
  const ids = [...new Set([
    ...owned.map((row) => Number(row.id)),
    ...written.map((row) => Number(row.cardId))
  ])].filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return [];

  const live = await Product.findAll({
    where: { id: { [Op.in]: ids }, ...notDeletedCard() },
    attributes: ["id"]
  });
  return live.map((row) => Number(row.id));
}

async function getUnreadSummary(userId) {
  const uid = toPositiveInt(userId);
  if (!uid) return { cards: {}, total: 0 };
  const cardIds = await getWatchedCardIds(uid);
  if (!cardIds.length) return { cards: {}, total: 0 };

  const [reads, comments] = await Promise.all([
    ChatRead.findAll({
      where: { userId: uid, cardId: { [Op.in]: cardIds } },
      attributes: ["cardId", "lastReadAt"]
    }),
    Comment.findAll({
      where: {
        cardId: { [Op.in]: cardIds },
        deleted: false,
        userId: { [Op.ne]: uid }
      },
      attributes: ["cardId", "userId", "createdAt", "deleted"]
    })
  ]);

  const lastReadByCard = {};
  for (const row of reads) {
    lastReadByCard[String(row.cardId)] = row.lastReadAt;
  }

  const byCard = {};
  for (const comment of comments) {
    const key = String(comment.cardId);
    if (!byCard[key]) byCard[key] = [];
    byCard[key].push(comment);
  }

  const cards = {};
  for (const cardId of cardIds) {
    const key = String(cardId);
    const unread = countUnreadComments({
      comments: byCard[key] || [],
      lastReadAt: lastReadByCard[key] || null,
      userId: uid
    });
    if (unread > 0) cards[key] = unread;
  }

  const total = Object.values(cards).reduce((sum, n) => sum + n, 0);
  return { cards, total };
}

async function markCardRead(userId, cardId) {
  const uid = toPositiveInt(userId);
  const cid = toPositiveInt(cardId);
  if (!uid || !cid) return null;
  const now = new Date();
  const existing = await ChatRead.findOne({ where: { userId: uid, cardId: cid } });
  if (existing) {
    existing.lastReadAt = now;
    await existing.save();
    return existing;
  }
  return ChatRead.create({ userId: uid, cardId: cid, lastReadAt: now });
}

module.exports = {
  getUnreadSummary,
  markCardRead,
  getWatchedCardIds
};
