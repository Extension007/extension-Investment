function getUserId(user) {
  if (!user) return "";
  const raw = user._id != null ? user._id : user.id;
  return raw != null ? String(raw) : "";
}

function canDeleteComment(user, comment) {
  if (!user || !comment) return false;
  if (user.role === "admin") return true;
  const uid = getUserId(user);
  const author = comment.userId != null ? String(comment.userId) : "";
  return Boolean(uid && author && uid === author);
}

module.exports = { getUserId, canDeleteComment };
