function serializeComment(row, extras = {}) {
  if (!row) return null;
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : { ...row };
  const nestedUser = extras.user || plain.user || {};
  const username =
    extras.username ||
    nestedUser.username ||
    plain.username ||
    plain["user.username"] ||
    null;
  const id = plain.id != null ? plain.id : (plain._id != null ? plain._id : extras.id);
  if (id == null || plain.text == null || String(plain.text).trim() === "") return null;

  const cardId = plain.cardId != null ? plain.cardId : extras.cardId;
  return {
    id,
    _id: id,
    cardId: cardId != null ? String(cardId) : "",
    cardType: plain.cardType || extras.cardType || null,
    userId: plain.userId != null ? plain.userId : (nestedUser.id != null ? nestedUser.id : nestedUser._id),
    username: username || "Пользователь",
    text: String(plain.text),
    createdAt: plain.createdAt || extras.createdAt || null,
    updatedAt: plain.updatedAt || extras.updatedAt || null
  };
}

module.exports = { serializeComment };
