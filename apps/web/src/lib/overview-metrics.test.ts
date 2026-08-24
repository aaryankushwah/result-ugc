import { describe, expect, it } from "vitest";
import { defaultOverviewMetricIds, readOverviewMetricIds, toggleOverviewMetric } from "./overview-metrics";

describe("overview metric preferences", () => {
  it("uses the useful default dashboard metrics", () => {
    expect(readOverviewMetricIds(null)).toEqual(defaultOverviewMetricIds);
    expect(defaultOverviewMetricIds).toEqual(["views", "engagement", "likes", "comments", "shares", "videos"]);
  });

  it("keeps valid unique metric ids and ignores unknown ids", () => {
    expect(readOverviewMetricIds("views,likes,views,unknown")).toEqual(["views", "likes"]);
  });

  it("always leaves at least one metric visible", () => {
    expect(toggleOverviewMetric(["views"], "views")).toEqual(["views"]);
    expect(toggleOverviewMetric(["views", "likes"], "views")).toEqual(["likes"]);
  });
});
