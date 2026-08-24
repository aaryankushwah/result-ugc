import { describe, expect, it } from "vitest";
import { sevenDayPostActivity } from "./table-metrics";

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
