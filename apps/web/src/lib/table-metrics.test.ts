import { describe, expect, it } from "vitest";
import { calendarWeekPostActivity, creatorPostActivity } from "./table-metrics";

describe("calendar-week post activity", () => {
  it("counts only the selected accounts inside the Monday-to-Sunday UTC week", () => {
    const activity = calendarWeekPostActivity([
      { accountId: "one", publishedAt: "2026-08-24T12:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-24T18:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-30T01:00:00.000Z" },
      { accountId: "two", publishedAt: "2026-08-24T12:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-23T23:59:59.000Z" },
      { accountId: "one", publishedAt: "2026-08-31T00:00:00.000Z" },
    ], ["one"], 0, new Date("2026-08-26T20:00:00.000Z"));

    expect(activity.map((day) => day.date)).toEqual([
      "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30",
    ]);
    expect(activity.map((day) => day.label)).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
    expect(activity.map((day) => day.count)).toEqual([2, 0, 0, 0, 0, 0, 1]);
  });

  it("moves backward in whole calendar weeks", () => {
    const activity = calendarWeekPostActivity([
      { accountId: "one", publishedAt: "2026-08-17T10:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-23T10:00:00.000Z" },
      { accountId: "one", publishedAt: "2026-08-24T10:00:00.000Z" },
    ], ["one"], 1, new Date("2026-08-26T20:00:00.000Z"));
    expect(activity.map((day) => day.date)).toEqual([
      "2026-08-17", "2026-08-18", "2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22", "2026-08-23",
    ]);
    expect(activity.map((day) => day.count)).toEqual([1, 0, 0, 0, 0, 0, 1]);
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
    expect(rows[0]).toMatchObject({ creatorId: "creator-one", posts: 13, postsThisWeek: 3, goalsHit: 2, goalsTotal: 14 });
    expect(rows[0]?.activity.map((day) => day.count)).toEqual([3, 0, 0, 0, 0, 0, 0]);
    expect(rows[1]).toMatchObject({ creatorId: "creator-two", posts: 0, postsThisWeek: 0, goalsHit: 0, goalsTotal: 0 });
  });
});
