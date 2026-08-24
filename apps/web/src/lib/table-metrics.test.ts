import { describe, expect, it } from "vitest";
import { creatorPostActivity, sevenDayPostActivity } from "./table-metrics";

describe("seven-day post activity", () => {
  it("counts only the selected accounts inside the rolling UTC window", () => {
    const activity = sevenDayPostActivity([
      { accountId: "one", publishedAt: "2026-08-24T12:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-24T18:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-18T01:00:00.000Z" },
      { accountId: "two", publishedAt: "2026-08-24T12:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-17T23:59:59.000Z" },
    ], ["one"], new Date("2026-08-24T20:00:00.000Z"));

    expect(activity.map((day) => day.date)).toEqual([
      "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23", "2026-08-24",
    ]);
    expect(activity.map((day) => day.count)).toEqual([1, 0, 0, 0, 0, 0, 2]);
  });
});

describe("creator post activity", () => {
  it("keeps every creator and rolls up posts across all of their accounts", () => {
    const rows = creatorPostActivity([
      { id: "creator-one", accounts: [
        { id: "instagram", posts: 8, linkState: "confirmed" },
        { id: "tiktok", posts: 5, linkState: "confirmed" },
        { id: "suggested", posts: 20, linkState: "suggested" },
      ] },
      { id: "creator-two", accounts: [] },
    ], [
      { accountId: "instagram", publishedAt: "2026-08-24T12:00:00.000Z" },
      { accountId: "instagram", publishedAt: "2026-08-24T14:00:00.000Z" },
      { accountId: "tiktok", publishedAt: "2026-08-24T18:00:00.000Z" },
      { accountId: "suggested", publishedAt: "2026-08-24T19:00:00.000Z" },
    ], new Date("2026-08-24T20:00:00.000Z"));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ creatorId: "creator-one", posts: 13, posts7d: 3, goalsHit: 2, goalsTotal: 14 });
    expect(rows[0]?.activity.map((day) => day.count)).toEqual([0, 0, 0, 0, 0, 0, 3]);
    expect(rows[1]).toMatchObject({ creatorId: "creator-two", posts: 0, posts7d: 0, goalsHit: 0, goalsTotal: 0 });
  });
});
