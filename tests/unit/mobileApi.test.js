const { isMobileApiPath, shouldSkipCsrf, shouldSkipOriginCheck, requestFullPath } = require("../../utils/mobileApi");
const { serializeMobileCard, serializeMobileUser, serializeContacts } = require("../../utils/mobileSerialize");

describe("mobile API path helper", () => {
  test("matches only the /api/mobile prefix", () => {
    expect(isMobileApiPath({ originalUrl: "/api/mobile/v1/auth/login" })).toBe(true);
    expect(isMobileApiPath({ originalUrl: "/api/mobile" })).toBe(true);
    expect(isMobileApiPath({ originalUrl: "/api/mobile/v1/cards/9?x=1" })).toBe(true);
    expect(isMobileApiPath({ originalUrl: "/api/products" })).toBe(false);
    expect(isMobileApiPath({ originalUrl: "/api/mobile-extra" })).toBe(false);
    expect(isMobileApiPath({ path: "/user/login" })).toBe(false);
  });

  test("uses originalUrl inside a mounted router", () => {
    expect(requestFullPath({
      originalUrl: "/api/mobile/v1/me",
      baseUrl: "/api/mobile",
      path: "/v1/me"
    })).toBe("/api/mobile/v1/me");
    expect(shouldSkipCsrf({ originalUrl: "/api/mobile/v1/me" })).toBe(true);
    expect(shouldSkipOriginCheck({ originalUrl: "/api/mobile/v1/auth/login" })).toBe(true);
    expect(shouldSkipOriginCheck({ originalUrl: "/cabinet" })).toBe(false);
  });
});

describe("mobile serializers", () => {
  test("login payload user shape", () => {
    expect(serializeMobileUser({
      _id: "12",
      username: "anna",
      role: "user",
      email: "anna@example.com",
      emailVerified: true,
      accountType: "services"
    })).toEqual({
      id: "12",
      username: "anna",
      role: "user",
      email: "anna@example.com",
      emailVerified: true,
      accountType: "services"
    });
  });

  test("catalog card is photo-first and keeps contacts", () => {
    const card = serializeMobileCard({
      id: 8,
      name: "Мастер",
      description: "Ремонт",
      price: "15000",
      type: "service",
      images: ["https://img.example/1.jpg"],
      video_url: "https://youtu.be/x",
      link: "https://example.com",
      contacts: { phone: "+7700", telegram: "@shop", whatsapp: "7700", email: "a@b.c" },
      city: "Алматы",
      country: "Казахстан",
      likes: 4,
      dislikes: 1,
      status: "approved",
      deleted: false,
      expiresAt: new Date(Date.now() + 86400000),
      owner: { id: 2, username: "owner" }
    });

    expect(card.title).toBe("Мастер");
    expect(card.imageUrl).toBe("https://img.example/1.jpg");
    expect(card.priceLabel).toMatch(/₸/);
    expect(card.location).toContain("Алматы");
    expect(card.contacts.telegram).toBe("@shop");
    expect(card.likes).toBe(4);
    expect(card.rating).toBe(3);
    expect(card.live).toBe(true);
    expect(card.autoRenew).toBeUndefined();
  });

  test("owner fields appear only when requested", () => {
    const card = serializeMobileCard({
      id: 1,
      name: "Ad",
      price: "договорная",
      status: "pending",
      autoRenew: true,
      deleted: false
    }, { includeOwnerFields: true });
    expect(card.autoRenew).toBe(true);
    expect(card.status).toBe("pending");
    expect(serializeContacts({ contact_method: "WhatsApp" }).contactMethod).toBe("WhatsApp");
  });
});
