import { describe, expect, it } from "vitest";
import { accountAnalyticsByIdentity, companyConfiguredCpm, creatorCpmMetrics, formatConfiguredCpm } from "./launchpoint-cpm";

describe("Launchpoint CPM", () => {
  it("matches account analytics only by normalized platform and handle", () => {
    const lookup = accountAnalyticsByIdentity([{ handle: "@Jimi", platform: "Instagram", contractorId: "creator-1", cpm: 4.25 }]);
    expect(lookup.get("instagram:jimi")?.cpm).toBe(4.25);
    expect(lookup.get("tiktok:jimi")).toBeUndefined();
  });

  it("weights creator realized CPM by earnings and views", () => {
    const result = creatorCpmMetrics("creator-1", [
      { handle: "one", platform: "instagram", contractorId: "creator-1", totalEarnings: 10, totalViews: 1_000, cpm: 10 },
      { handle: "two", platform: "tiktok", contractorId: "creator-1", totalEarnings: 10, totalViews: 9_000, cpm: 1.111 },
    ], []);
    expect(result.realizedCpm).toBe(2);
  });

  it("converts configured rates from cents and preserves multi-program ranges", () => {
    const result = creatorCpmMetrics("creator-1", [], [
      { creatorId: "creator-1", money: { cpmCents: 400 } },
      { creatorId: "creator-1", money: { cpmCents: 650 } },
    ]);
    expect(formatConfiguredCpm(result.configuredCpmMin, result.configuredCpmMax)).toBe("$4.00–$6.50");
  });

  it("keeps configured CPM and its aggregate earning cap separate from realized CPM", () => {
    expect(companyConfiguredCpm([
      { creatorId: "one", money: { cpmCents: 400, maxCpmEarnableCents: 25_000 } },
      { creatorId: "two", money: { cpmCents: 650, maxCpmEarnableCents: 50_000 } },
      { creatorId: "unrelated", money: { cpmCents: 99_900, maxCpmEarnableCents: 9_999_900 } },
    ], [
      { handle: "one", platform: "instagram", contractorId: "one" },
      { handle: "two", platform: "tiktok", contractorId: "two" },
    ])).toEqual({ configuredCpmMin: 4, configuredCpmMax: 6.5, maxCpmEarnable: 750 });
  });

  it("does not treat campaign defaults for untracked creators as company payout", () => {
    expect(companyConfiguredCpm([
      { creatorId: "unrelated", money: { cpmCents: 400, maxCpmEarnableCents: 25_000 } },
    ], [])).toEqual({ configuredCpmMin: null, configuredCpmMax: null, maxCpmEarnable: null });
  });
});
