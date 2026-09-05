const {
  computeExpiresAt,
  computeEditUntil,
  isExpired,
  isLive,
  canUserEditCard,
  publicationFieldsOnApprove,
  republicationResetFields,
  PUBLICATION_EXPIRED_REASON,
  FREE_LIFETIME_DAYS,
  EDIT_WINDOW_HOURS
} = require("../../utils/cardPublication");

describe("cardPublication", () => {
  const publishedAt = new Date("2026-01-01T12:00:00.000Z");

  test("free cards expire after 7 days", () => {
    const expires = computeExpiresAt(publishedAt, "free");
    expect(expires.toISOString()).toBe("2026-01-08T12:00:00.000Z");
    expect(FREE_LIFETIME_DAYS).toBe(7);
  });

  test("paid cards expire after one calendar month", () => {
    const expires = computeExpiresAt(publishedAt, "paid");
    expect(expires.toISOString()).toBe("2026-02-01T12:00:00.000Z");
  });

  test("edit window is 24 hours after publication", () => {
    const until = computeEditUntil(publishedAt);
    expect(until.toISOString()).toBe("2026-01-02T12:00:00.000Z");
    expect(EDIT_WINDOW_HOURS).toBe(24);
  });

  test("isLive requires approved and unexpired", () => {
    const card = {
      status: "approved",
      expiresAt: new Date("2026-01-08T12:00:00.000Z")
    };
    expect(isLive(card, new Date("2026-01-05T12:00:00.000Z"))).toBe(true);
    expect(isLive(card, new Date("2026-01-09T12:00:00.000Z"))).toBe(false);
    expect(isLive({ ...card, status: "pending" }, new Date("2026-01-05T12:00:00.000Z"))).toBe(false);
  });

  test("expired reason marks card expired even without date", () => {
    expect(isExpired({ rejectionReason: PUBLICATION_EXPIRED_REASON })).toBe(true);
  });

  test("user can edit before first approval and within 24h after", () => {
    expect(canUserEditCard({ status: "pending" })).toBe(true);
    const card = {
      status: "approved",
      publishedAt,
      editUntil: computeEditUntil(publishedAt),
      expiresAt: computeExpiresAt(publishedAt, "free")
    };
    expect(canUserEditCard(card, new Date("2026-01-01T18:00:00.000Z"))).toBe(true);
    expect(canUserEditCard(card, new Date("2026-01-02T13:00:00.000Z"))).toBe(false);
  });

  test("pending and rejected cards stay editable", () => {
    const published = {
      publishedAt,
      editUntil: computeEditUntil(publishedAt),
      expiresAt: computeExpiresAt(publishedAt, "free")
    };
    expect(canUserEditCard({ ...published, status: "pending" }, new Date("2026-01-10T12:00:00.000Z"))).toBe(true);
    expect(canUserEditCard({ ...published, status: "rejected" }, new Date("2026-01-10T12:00:00.000Z"))).toBe(true);
  });

  test("zero-length backfill window still allows 24h from publishedAt", () => {
    const card = {
      status: "approved",
      publishedAt,
      editUntil: publishedAt,
      expiresAt: computeExpiresAt(publishedAt, "free")
    };
    expect(canUserEditCard(card, new Date("2026-01-01T18:00:00.000Z"))).toBe(true);
    expect(canUserEditCard(card, new Date("2026-01-02T13:00:00.000Z"))).toBe(false);
  });

  test("re-approval keeps clocks if still live", () => {
    const card = {
      tier: "free",
      publishedAt,
      expiresAt: computeExpiresAt(publishedAt, "free"),
      editUntil: computeEditUntil(publishedAt)
    };
    const fields = publicationFieldsOnApprove(card, new Date("2026-01-03T12:00:00.000Z"));
    expect(fields).toEqual({ status: "approved", rejectionReason: "" });
  });

  test("fresh approval sets publication clocks", () => {
    const now = new Date("2026-03-10T08:00:00.000Z");
    const fields = publicationFieldsOnApprove({ tier: "paid" }, now);
    expect(fields.status).toBe("approved");
    expect(fields.publishedAt.toISOString()).toBe(now.toISOString());
    expect(fields.expiresAt.toISOString()).toBe("2026-04-10T08:00:00.000Z");
    expect(fields.editUntil.toISOString()).toBe("2026-03-11T08:00:00.000Z");
  });

  test("republication becomes a new paid pending card", () => {
    expect(republicationResetFields()).toMatchObject({
      status: "pending",
      tier: "paid",
      publishedAt: null,
      expiresAt: null
    });
  });

  test("auto-renew only runs for expired opted-in cards", () => {
    const { shouldAttemptAutoRenew } = require("../../utils/cardPublication");
    const live = {
      autoRenew: true,
      status: "approved",
      expiresAt: new Date("2026-02-01T12:00:00.000Z")
    };
    expect(shouldAttemptAutoRenew(live, new Date("2026-01-15T12:00:00.000Z"))).toBe(false);
    expect(shouldAttemptAutoRenew(live, new Date("2026-02-02T12:00:00.000Z"))).toBe(true);
    expect(shouldAttemptAutoRenew({ ...live, autoRenew: false }, new Date("2026-02-02T12:00:00.000Z"))).toBe(false);
    expect(shouldAttemptAutoRenew({
      autoRenew: true,
      status: "rejected",
      rejectionReason: PUBLICATION_EXPIRED_REASON,
      expiresAt: new Date("2026-01-01T12:00:00.000Z")
    }, new Date("2026-02-02T12:00:00.000Z"))).toBe(true);
    expect(shouldAttemptAutoRenew({
      autoRenew: true,
      status: "rejected",
      rejectionReason: "spam",
      expiresAt: new Date("2026-01-01T12:00:00.000Z")
    }, new Date("2026-02-02T12:00:00.000Z"))).toBe(false);
    expect(shouldAttemptAutoRenew({
      autoRenew: true,
      deleted: true,
      status: "approved",
      expiresAt: new Date("2026-01-01T12:00:00.000Z")
    })).toBe(false);
  });

  test("auto-renew extends a paid month from now and keeps the card live", () => {
    const { autoRenewExtensionFields } = require("../../utils/cardPublication");
    const fields = autoRenewExtensionFields(new Date("2026-03-10T08:00:00.000Z"));
    expect(fields).toMatchObject({
      status: "approved",
      rejectionReason: "",
      tier: "paid"
    });
    expect(fields.expiresAt.toISOString()).toBe("2026-04-10T08:00:00.000Z");
  });

  test("auto-renew idempotency key is stable per card expiry", () => {
    const { autoRenewIdempotencyKey } = require("../../utils/cardPublication");
    const card = { id: 42, expiresAt: new Date("2026-02-01T12:00:00.000Z") };
    expect(autoRenewIdempotencyKey(card)).toBe("auto-renew:42:2026-02-01T12:00:00.000Z");
    expect(autoRenewIdempotencyKey(card).length).toBeLessThanOrEqual(100);
  });
});
