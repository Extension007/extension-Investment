const { canDeleteComment } = require("../../utils/commentAccess");

describe("commentAccess", () => {
  const comment = { id: 9, userId: 4, text: "hi" };

  test("author can delete own comment", () => {
    expect(canDeleteComment({ id: 4, role: "user" }, comment)).toBe(true);
    expect(canDeleteComment({ _id: "4", role: "user" }, comment)).toBe(true);
  });

  test("other users cannot delete", () => {
    expect(canDeleteComment({ id: 8, role: "user" }, comment)).toBe(false);
    expect(canDeleteComment(null, comment)).toBe(false);
  });

  test("admin can delete any comment", () => {
    expect(canDeleteComment({ id: 1, role: "admin" }, comment)).toBe(true);
  });
});
