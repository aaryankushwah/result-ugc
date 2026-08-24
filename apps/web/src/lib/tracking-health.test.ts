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

  it("surfaces the weakest account on a creator", () => {
    expect(aggregateAccountPerformanceHealth(["healthy", "warming"])).toBe("warming");
    expect(aggregateAccountPerformanceHealth(["healthy", "at_risk"])).toBe("at_risk");
    expect(aggregateAccountPerformanceHealth([])).toBe("unknown");
  });
});
