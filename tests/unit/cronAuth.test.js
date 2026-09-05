const { isExpireJobAuthorized } = require("../../utils/cronAuth");

describe("expire job auth", () => {
  test("rejects empty secret and spoofed User-Agent", () => {
    const req = {
      get: (name) => (name === "authorization" ? "" : "vercel-cron"),
      headers: { "user-agent": "vercel-cron" },
      user: null
    };
    expect(isExpireJobAuthorized(req, "")).toBe(false);
    expect(isExpireJobAuthorized(req, "super-secret")).toBe(false);
  });

  test("allows Bearer CRON_SECRET", () => {
    const req = {
      get: (name) => (name === "authorization" ? "Bearer super-secret" : ""),
      headers: {},
      user: null
    };
    expect(isExpireJobAuthorized(req, "super-secret")).toBe(true);
    expect(isExpireJobAuthorized(req, "other")).toBe(false);
  });

  test("allows admin without secret", () => {
    const req = {
      get: () => "",
      headers: {},
      user: { role: "admin" }
    };
    expect(isExpireJobAuthorized(req, "")).toBe(true);
  });
});
