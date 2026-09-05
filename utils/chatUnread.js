function countUnreadComments({ comments, lastReadAt, userId }) {
  const cutoff = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  const uid = userId != null ? String(userId) : "";
  let unread = 0;
  for (const comment of comments || []) {
    if (!comment || comment.deleted) continue;
    const author = comment.userId != null ? String(comment.userId) : "";
    if (uid && author === uid) continue;
    const created = comment.createdAt ? new Date(comment.createdAt).getTime() : 0;
    if (!cutoff || created > cutoff) unread += 1;
  }
  return unread;
}

function mergeUnreadMaps(maps) {
  const cards = {};
  for (const map of maps || []) {
    if (!map) continue;
    for (const [cardId, count] of Object.entries(map)) {
      const n = Number(count) || 0;
      if (n <= 0) continue;
      cards[String(cardId)] = (cards[String(cardId)] || 0) + n;
    }
  }
  const total = Object.values(cards).reduce((sum, n) => sum + n, 0);
  return { cards, total };
}

module.exports = { countUnreadComments, mergeUnreadMaps };
