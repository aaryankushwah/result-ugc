import { describe, expect, it } from "vitest";
import { buildPerformance } from "./performance";

describe("buildPerformance", () => {
  it("aggregates included videos and distinct active accounts by publish date", () => {
    const result = buildPerformance([
      { accountId: "a", included: true, publishedAt: "2026-08-24T10:00:00.000Z", views: 100, likes: 10, comments: 2, shares: 3, bookmarks: 5 },
      { accountId: "b", included: true, publishedAt: "2026-08-24T12:00:00.000Z", views: 300, likes: 20, comments: 4, shares: 5, bookmarks: 7 },
      { accountId: "c", included: false, publishedAt: "2026-08-24T14:00:00.000Z", views: 900, likes: 90, comments: 9, shares: 9, bookmarks: 9 },
    ], 2, new Date("2026-08-24T18:00:00.000Z"));

    expect(result[0]).toMatchObject({ date: "2026-08-23", posts: 0, views: 0, activeAccounts: 0 });
    expect(result[1]).toMatchObject({ date: "2026-08-24", posts: 2, views: 400, activeAccounts: 2, likes: 30, comments: 6, shares: 8, bookmarks: 12 });
    expect(result[1].engagementRate).toBeCloseTo(0.14);
  });
});
