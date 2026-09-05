function isExpireJobAuthorized(req, secret = process.env.CRON_SECRET) {
  if (req.user && req.user.role === "admin") return true;
  const expected = String(secret || "");
  if (!expected) return false;
  const auth = String(
    (typeof req.get === "function" && req.get("authorization")) ||
    (req.headers && req.headers.authorization) ||
    ""
  );
  return auth === `Bearer ${expected}`;
}

module.exports = { isExpireJobAuthorized };
