import { describe, expect, it } from "vitest";
import { buildOverviewSignals } from "./overview-signals";

const now = new Date("2026-08-27T12:00:00.000Z");
const video = (overrides: Record<string, unknown> = {}) => ({
  id: "video-1", accountId: "account-1", accountUsername: "jimi", caption: "A useful clip", publishedAt: "2026-08-26T12:00:00.000Z",
  views: 1_000, comments: 1, baselineMultiplier: 1, included: true, ...overrides,
});

describe("overview outlier signals", () => {
  it("surfaces recent videos materially above baseline", () => {
    const signals = buildOverviewSignals({ creators: [], accounts: [], videos: [video({ baselineMultiplier: 2.8 })], now });
    expect(signals[0]).toMatchObject({ kind: "breakout", metric: "2.8×", href: "/videos/video-1" });
  });

  it("surfaces comment outliers relative to the current month", () => {
    const signals = buildOverviewSignals({ creators: [], accounts: [], videos: [
      video({ id: "ordinary-1", comments: 1 }),
      video({ id: "ordinary-2", comments: 1 }),
      video({ id: "ordinary-3", comments: 2 }),
      video({ id: "discussion", comments: 8, baselineMultiplier: 1 }),
    ], now });
    expect(signals).toContainEqual(expect.objectContaining({ id: "comments:discussion", metric: "8 comments" }));
  });

  it("uses the existing account health classification and reason", () => {
    const signals = buildOverviewSignals({ creators: [], videos: [], accounts: [{ id: "account-1", username: "jimi", performanceHealth: "at_risk", performanceHealthReason: "recent median views are 40% of baseline" }], now });
    expect(signals[0]).toMatchObject({ kind: "risk", detail: "recent median views are 40% of baseline" });
  });

  it("judges posting cadence only against elapsed weekdays", () => {
    const signals = buildOverviewSignals({
      creators: [{ id: "creator-1", displayName: "Jimi", lifecycle: "active", accounts: [{ id: "account-1", linkState: "confirmed" }] }],
      accounts: [],
      videos: [video({ publishedAt: "2026-08-24T12:00:00.000Z" })],
      now,
    });
    expect(signals).toContainEqual(expect.objectContaining({ kind: "cadence", detail: "1 of 4 account-day goals hit this week", metric: "3 missed" }));
  });
});
