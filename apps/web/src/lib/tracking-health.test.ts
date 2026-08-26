import { aggregateAccountPerformanceHealth, aggregateTrackingState, deriveAccountPerformanceHealth } from "@result/domain";
import { describe, expect, it } from "vitest";

describe("creator account health", () => {
  it("uses the most actionable state across confirmed accounts", () => {
    expect(aggregateTrackingState([])).toBe("untracked");
    expect(aggregateTrackingState(["healthy", "healthy"])).toBe("healthy");
    expect(aggregateTrackingState(["healthy", "pending"])).toBe("pending");
    expect(aggregateTrackingState(["healthy", "stale", "pending"])).toBe("stale");
    expect(aggregateTrackingState(["healthy", "stale", "failed"])).toBe("failed");
  });
});

describe("Viral account performance health", () => {
  const now = new Date("2026-08-24T12:00:00Z");
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const countedPost = (days: number, views: number) => ({ publishedAt: daysAgo(days), views, included: true });
  const warmupPost = (days: number, views: number) => ({ publishedAt: daysAgo(days), views, included: false });

  it("ignores warm-up posts when deciding whether an account is warmed up", () => {
    expect(deriveAccountPerformanceHealth({
      videos: [warmupPost(30, 90_000), warmupPost(28, 70_000), warmupPost(26, 50_000), countedPost(2, 900)],
      now,
    })).toMatchObject({ state: "warming", warmedUp: false, trackedPosts: 1, warmupPosts: 3, reason: "warm-up in progress — 1 of 3 counted posts" });
  });

  it("reports an account with only warm-up posts as still warming", () => {
    expect(deriveAccountPerformanceHealth({ videos: [warmupPost(5, 100_000), warmupPost(3, 80_000)], now }))
      .toMatchObject({ state: "warming", warmedUp: false, trackedPosts: 0, warmupPosts: 2 });
  });

  it("builds the view baseline from counted posts only", () => {
    expect(deriveAccountPerformanceHealth({
      videos: [warmupPost(40, 500_000), countedPost(30, 1_000), countedPost(20, 1_000), countedPost(10, 1_000), countedPost(2, 950)],
      now,
    })).toMatchObject({ state: "healthy", warmedUp: true, trackedPosts: 4, baselineMedianViews: 1_000 });
  });

  it("flags weak recent performance after warm-up", () => {
    expect(deriveAccountPerformanceHealth({
      videos: [countedPost(60, 1_000), countedPost(50, 1_000), countedPost(45, 1_000), countedPost(12, 300), countedPost(9, 300), countedPost(1, 0)],
      now,
    })).toMatchObject({ state: "at_risk", reason: "recent median views are 30% of baseline" });
  });

  it("keeps a warmed-up account healthy on a light posting week", () => {
    expect(deriveAccountPerformanceHealth({
      videos: [countedPost(30, 1_000), countedPost(20, 1_000), countedPost(10, 1_100), countedPost(1, 400)],
      now,
    })).toMatchObject({ state: "healthy", warmedUp: true, recentPosts: 1 });
  });

  it("does not fall back to warm-up before a baseline can be measured", () => {
    expect(deriveAccountPerformanceHealth({ videos: [countedPost(3, 800), countedPost(2, 900), countedPost(1, 700)], now }))
      .toMatchObject({ state: "healthy", warmedUp: true, baselineMedianViews: null });
  });

  it("separates a stalled account from a warming one", () => {
    expect(deriveAccountPerformanceHealth({ videos: [countedPost(30, 1_000), countedPost(20, 1_000), countedPost(9, 1_000)], now }))
      .toMatchObject({ state: "inactive", warmedUp: true });
    expect(deriveAccountPerformanceHealth({ videos: [countedPost(30, 1_000), countedPost(20, 1_000), countedPost(5, 1_000)], now }))
      .toMatchObject({ state: "at_risk", warmedUp: true });
  });

  it("reports an account with no synced posts as unknown", () => {
    expect(deriveAccountPerformanceHealth({ videos: [], now })).toMatchObject({ state: "unknown", trackedPosts: 0 });
  });

  it("surfaces the weakest account on a creator", () => {
    expect(aggregateAccountPerformanceHealth(["healthy", "warming"])).toBe("warming");
    expect(aggregateAccountPerformanceHealth(["healthy", "at_risk"])).toBe("at_risk");
    expect(aggregateAccountPerformanceHealth([])).toBe("unknown");
  });
});
