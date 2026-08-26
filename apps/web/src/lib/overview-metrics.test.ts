import { describe, expect, it } from "vitest";
import { defaultOverviewMetricIds, overviewMetricIds, readOverviewMetricIds, toggleOverviewMetric } from "./overview-metrics";

describe("overview metric preferences", () => {
  it("defaults to a readable subset of known stats, leading with performance", () => {
    expect(readOverviewMetricIds(null)).toEqual(defaultOverviewMetricIds);
    expect(defaultOverviewMetricIds.every((id) => overviewMetricIds.includes(id))).toBe(true);
    expect(new Set(defaultOverviewMetricIds).size).toBe(defaultOverviewMetricIds.length);
    expect(defaultOverviewMetricIds.slice(0, 3)).toEqual(["cpm", "views", "engagement"]);
    // Keep the rail scannable: past ~8 the cards shrink below a readable width.
    expect(defaultOverviewMetricIds.length).toBeLessThanOrEqual(8);
  });

  it("keeps valid unique metric ids and ignores unknown ids", () => {
    expect(readOverviewMetricIds("views,likes,views,unknown")).toEqual(["views", "likes"]);
  });

  it("always leaves at least one metric visible", () => {
    expect(toggleOverviewMetric(["views"], "views")).toEqual(["views"]);
    expect(toggleOverviewMetric(["views", "likes"], "views")).toEqual(["likes"]);
  });
});
