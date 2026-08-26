import { describe, expect, it } from "vitest";
import { accountAnalyticsByIdentity, creatorCpmMetrics, formatConfiguredCpm } from "./launchpoint-cpm";

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
});
