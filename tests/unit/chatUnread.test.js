const { countUnreadComments, mergeUnreadMaps } = require("../../utils/chatUnread");

describe("chatUnread", () => {
  const comments = [
    { userId: 2, createdAt: "2026-01-01T10:00:00.000Z" },
    { userId: 1, createdAt: "2026-01-01T11:00:00.000Z" },
    { userId: 3, createdAt: "2026-01-01T12:00:00.000Z" },
    { userId: 3, createdAt: "2026-01-01T09:00:00.000Z", deleted: true }
  ];

  test("counts other users comments after last read", () => {
    expect(countUnreadComments({
      comments,
      lastReadAt: "2026-01-01T10:30:00.000Z",
      userId: 1
    })).toBe(1);
  });

  test("without last read counts all others", () => {
    expect(countUnreadComments({ comments, userId: 1 })).toBe(2);
  });

  test("merges unread maps", () => {
    expect(mergeUnreadMaps([{ "4": 2 }, { "4": 1, "9": 3 }])).toEqual({
      cards: { "4": 3, "9": 3 },
      total: 6
    });
  });
});
