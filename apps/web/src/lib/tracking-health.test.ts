import { aggregateAccountPerformanceHealth, aggregateTrackingState, deriveAccountPerformanceHealth } from "../../../../packages/domain/src/index";
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
  const activePosting = [
    { date: "2026-08-19", postedVideos: 1 },
    { date: "2026-08-21", postedVideos: 2 },
    { date: "2026-08-23", postedVideos: 1 },
  ];

  it("marks a consistently posting account with recent baseline performance healthy", () => {
    expect(deriveAccountPerformanceHealth({
      totalVideosPublished: 12,
      p50Views: 1_000,
      postActivity: activePosting,
      weeklyViewStats: [{ weekStart: "2026-08-17", avgViews: 980, p50Views: 900 }],
      daysSinceLastPost: 1,
      now,
    })).toMatchObject({ state: "healthy", reason: "recent videos performing", recentPosts: 4 });
  });

  it("flags weak recent performance after warm-up", () => {
    expect(deriveAccountPerformanceHealth({
      totalVideosPublished: 12,
      p50Views: 1_000,
      postActivity: activePosting,
      weeklyViewStats: [{ weekStart: "2026-08-17", avgViews: 420, p50Views: 400 }],
      daysSinceLastPost: 1,
      now,
    })).toMatchObject({ state: "at_risk", reason: "recent median views are 40% of baseline" });
  });

  it("keeps sparse new accounts in warm-up and separates inactive accounts", () => {
    expect(deriveAccountPerformanceHealth({ totalVideosPublished: 2, p50Views: 400, daysSinceLastPost: 1, now }).state).toBe("warming");
    expect(deriveAccountPerformanceHealth({ totalVideosPublished: 12, p50Views: 1_000, daysSinceLastPost: 9, now }).state).toBe("inactive");
  });

  it("keeps a warmed-up account healthy on a light posting week", () => {
    expect(deriveAccountPerformanceHealth({
      totalVideosPublished: 40,
      p50Views: 1_000,
      postActivity: [{ date: "2026-08-23", postedVideos: 1 }],
      weeklyViewStats: [{ weekStart: "2026-08-17", avgViews: 980, p50Views: 900 }],
      daysSinceLastPost: 1,
      now,
    })).toMatchObject({ state: "healthy", warmedUp: true, recentPosts: 1 });
  });

  it("does not fall back to warm-up when no completed week is available yet", () => {
    expect(deriveAccountPerformanceHealth({
      totalVideosPublished: 40,
      p50Views: 1_000,
      postActivity: activePosting,
      weeklyViewStats: [{ weekStart: "2026-08-24", avgViews: 980, p50Views: 900 }],
      daysSinceLastPost: 1,
      now,
    })).toMatchObject({ state: "healthy", warmedUp: true, recentMedianViews: null });
  });

  it("keeps an account warming until it has both enough posts and a baseline", () => {
    expect(deriveAccountPerformanceHealth({ totalVideosPublished: 0, daysSinceLastPost: null, now })).toMatchObject({ state: "warming", warmedUp: false });
    expect(deriveAccountPerformanceHealth({ totalVideosPublished: 12, p50Views: null, postActivity: activePosting, daysSinceLastPost: 1, now })).toMatchObject({ state: "warming", warmedUp: false, reason: "warm-up in progress — no view baseline yet" });
  });

  it("reports a warmed-up account with a slipping cadence as at risk, not warming", () => {
    expect(deriveAccountPerformanceHealth({
      totalVideosPublished: 40,
      p50Views: 1_000,
      weeklyViewStats: [{ weekStart: "2026-08-17", avgViews: 980, p50Views: 900 }],
      daysSinceLastPost: 5,
      now,
    })).toMatchObject({ state: "at_risk", warmedUp: true });
  });

  it("surfaces the weakest account on a creator", () => {
    expect(aggregateAccountPerformanceHealth(["healthy", "warming"])).toBe("warming");
    expect(aggregateAccountPerformanceHealth(["healthy", "at_risk"])).toBe("at_risk");
    expect(aggregateAccountPerformanceHealth([])).toBe("unknown");
  });
});
