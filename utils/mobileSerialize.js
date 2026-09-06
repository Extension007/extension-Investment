const { formatPriceDisplay } = require("./price");
const { formatLocation } = require("./catalogSearch");
const { isLive } = require("./cardPublication");

function serializeContacts(contacts) {
  const c = contacts && typeof contacts === "object" && !Array.isArray(contacts) ? contacts : {};
  return {
    phone: c.phone ? String(c.phone) : "",
    email: c.email ? String(c.email) : "",
    telegram: c.telegram ? String(c.telegram) : "",
    whatsapp: c.whatsapp ? String(c.whatsapp) : "",
    contactMethod: c.contact_method || c.contactMethod ? String(c.contact_method || c.contactMethod) : ""
  };
}

function serializeMobileUser(user) {
  if (!user) return null;
  const id = user._id != null ? String(user._id) : (user.id != null ? String(user.id) : null);
  return {
    id,
    username: user.username || "",
    role: user.role || "user",
    email: user.email || undefined,
    emailVerified: Boolean(user.emailVerified),
    accountType: user.accountType || "showcase",
    refCode: user.refCode || undefined
  };
}

function serializeMobileCard(row, { includeOwnerFields = false } = {}) {
  if (!row) return null;
  const plain = typeof row.get === "function" ? row.get({ plain: true }) : { ...row };
  const images = Array.isArray(plain.images) && plain.images.length
    ? plain.images.filter(Boolean)
    : (plain.image_url ? [plain.image_url] : []);
  const likes = Number(plain.likes) || 0;
  const dislikes = Number(plain.dislikes) || 0;
  const owner = plain.owner && typeof plain.owner === "object"
    ? { id: plain.owner.id, username: plain.owner.username || "" }
    : null;

  const card = {
    id: plain.id,
    type: plain.type === "service" ? "service" : "product",
    title: plain.name || "",
    name: plain.name || "",
    description: plain.description || "",
    price: plain.price || "",
    priceLabel: formatPriceDisplay(plain.price, plain.currency),
    currency: plain.currency || "KZT",
    sourceLocale: plain.sourceLocale || plain.source_locale || null,
    translations: plain.translations || {},
    location: formatLocation(plain) || "",
    country: plain.country || "",
    region: plain.region || "",
    city: plain.city || "",
    images,
    imageUrl: images[0] || null,
    videoUrl: plain.video_url || "",
    link: plain.link || "",
    contacts: serializeContacts(plain.contacts),
    tags: Array.isArray(plain.tags) ? plain.tags.map(String) : [],
    category: plain.category || "",
    categoryId: plain.categoryId || null,
    likes,
    dislikes,
    rating: likes - dislikes,
    totalVotes: likes + dislikes,
    live: isLive(plain),
    owner
  };

  if (includeOwnerFields) {
    card.status = plain.status || "";
    card.tier = plain.tier || "free";
    card.autoRenew = Boolean(plain.autoRenew);
    card.publishedAt = plain.publishedAt || null;
    card.expiresAt = plain.expiresAt || null;
    card.rejectionReason = plain.rejectionReason || plain.rejection_reason || "";
  }

  return card;
}

module.exports = {
  serializeContacts,
  serializeMobileUser,
  serializeMobileCard
};
