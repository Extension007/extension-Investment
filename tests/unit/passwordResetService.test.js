const {
  PURPOSE,
  MIN_PASSWORD_LEN
} = require("../../services/passwordResetService");

describe("passwordResetService constants", () => {
  test("uses dedicated purpose and min length", () => {
    expect(PURPOSE).toBe("password_reset");
    expect(MIN_PASSWORD_LEN).toBeGreaterThanOrEqual(6);
  });
});
