import { describe, expect, it } from "vitest";
import { creatorAccountTotals, creatorBaselineViews, creatorDailySeries, creatorRecentPosts, foldAccountTail } from "./creator-series";
import type { PortalCreator, PortalVideo } from "./portal-types";

const now = new Date("2026-08-25T12:00:00Z");

function creator(accountIds = ["acc-1"]): PortalCreator {
  return {
    id: "creator-1", displayName: "Creator", email: null, lifecycle: "active", attentionState: null, nextStep: null, managerName: null,
    discord: { state: "connected", userId: "1", username: "creator", displayName: null, avatarUrl: null, channelId: null, guildId: null },
    relationships: [], notes: [], posts30d: 0, views30d: 0, engagementRate: 0, trackingState: "healthy", lastActivityAt: null, source: "result",
    accounts: accountIds.map((id, index) => ({
      id, creatorId: "creator-1", platform: "tiktok", platformAccountId: id, username: `handle${index || ""}`, displayName: "", avatarUrl: null,
      followers: 0, following: 0, posts: 0, views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0, averageViews: 0, engagementRate: 0,
      latestPostAt: null, trackingState: "healthy", refreshedAt: null, linkState: "confirmed", error: null, sourceUrl: null,
    })),
  };
}

function video(overrides: Partial<PortalVideo> = {}): PortalVideo {
  return {
    id: "v1", accountId: "acc-1", creatorId: "creator-1", platform: "tiktok", platformAccountId: "acc-1", platformVideoId: "pv1",
    accountUsername: "handle", caption: "A post", thumbnailUrl: null, durationSeconds: null, publishedAt: "2026-08-25T09:00:00Z",
    views: 100, likes: 5, comments: 3, shares: 2, bookmarks: 0, engagementRate: 0.1, baselineMultiplier: 1, included: true,
    trackingState: "healthy", refreshedAt: null, error: null, sourceUrl: null, ...overrides,
  };
}

describe("creator daily series", () => {
  it("emits one row per day including days with no posts", () => {
    const rows = creatorDailySeries(creator(), [video()], 7, now);
    expect(rows).toHaveLength(7);
    expect(rows.at(-1)).toMatchObject({ date: "2026-08-25", views: 100, posts: 1 });
    expect(rows[0]).toMatchObject({ date: "2026-08-19", views: 0, posts: 0, engagementRate: 0 });
  });

  it("leaves excluded videos out of every total", () => {
    const rows = creatorDailySeries(creator(), [video({ included: false })], 7, now);
    expect(rows.at(-1)).toMatchObject({ views: 0, posts: 0 });
  });

  it("ignores videos belonging to another creator's accounts", () => {
    const rows = creatorDailySeries(creator(), [video({ accountId: "someone-else" })], 7, now);
    expect(rows.at(-1)!.views).toBe(0);
  });

  it("rates a day on its own totals rather than averaging per-video rates", () => {
    const rows = creatorDailySeries(creator(), [
      video({ id: "big", platformVideoId: "big", views: 10_000, likes: 100, comments: 0, shares: 0, bookmarks: 0 }),
      video({ id: "tiny", platformVideoId: "tiny", views: 10, likes: 5, comments: 0, shares: 0, bookmarks: 0 }),
    ], 7, now);
    // 105 engagements over 10,010 views ≈ 1.05%, not the 27.5% a naive mean gives.
    expect(rows.at(-1)!.engagementRate).toBeCloseTo(1.049, 2);
  });
});

describe("creator baseline and recent posts", () => {
  it("takes the median of counted views, averaging the middle pair when even", () => {
    const videos = [10, 20, 30, 100].map((views, index) => video({ id: `v${index}`, platformVideoId: `p${index}`, views }));
    expect(creatorBaselineViews(creator(), videos)).toBe(25);
    expect(creatorBaselineViews(creator(), videos.slice(0, 3))).toBe(20);
    expect(creatorBaselineViews(creator(), [])).toBe(0);
  });

  it("returns the newest posts oldest-first and caps them", () => {
    const videos = Array.from({ length: 5 }, (_, index) => video({ id: `v${index}`, platformVideoId: `p${index}`, caption: `post ${index}`, publishedAt: `2026-08-2${index}T09:00:00Z` }));
    const recent = creatorRecentPosts(creator(), videos, 3);
    expect(recent.map((row) => row.label)).toEqual(["post 2", "post 3", "post 4"]);
  });

  it("falls back to the video id when a caption is blank", () => {
    expect(creatorRecentPosts(creator(), [video({ caption: "   ", platformVideoId: "pv-9" })])[0]!.label).toBe("pv-9");
  });
});

describe("creator account totals", () => {
  it("labels accounts with their platform, ranks by counted views, and drops accounts with no counted posts", () => {
    const subject = creator(["acc-1", "acc-2", "acc-3"]);
    const totals = creatorAccountTotals(subject, [
      video({ id: "a", platformVideoId: "a", accountId: "acc-1", views: 50 }),
      video({ id: "b", platformVideoId: "b", accountId: "acc-2", views: 500 }),
      video({ id: "c", platformVideoId: "c", accountId: "acc-3", views: 900, included: false }),
    ]);
    expect(totals).toEqual([
      { account: "@handle1 · tiktok", views: 500, posts: 1 },
      { account: "@handle · tiktok", views: 50, posts: 1 },
    ]);
  });
});

describe("categorical folding", () => {
  const rows = Array.from({ length: 9 }, (_, index) => ({ account: `@a${index}`, views: 10 - index, posts: 1 }));

  it("leaves a list within the palette untouched", () => {
    expect(foldAccountTail(rows.slice(0, 6))).toHaveLength(6);
  });

  it("folds everything past the palette into one Other row instead of reusing a hue", () => {
    const folded = foldAccountTail(rows);
    expect(folded).toHaveLength(7);
    expect(folded.at(-1)).toEqual({ account: "Other (3 accounts)", views: 4 + 3 + 2, posts: 3 });
  });
});
