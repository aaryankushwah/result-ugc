import { describe, expect, it } from "vitest";
import { engagementTotals, totalInteractions } from "./engagement";
import type { PortalVideo } from "./portal-types";

function video(partial: Partial<PortalVideo>): PortalVideo {
  return {
    id: "v1", accountId: "a1", creatorId: "c1", platform: "instagram", platformAccountId: "pa1",
    platformVideoId: "pv1", accountUsername: "creator", caption: "clip", thumbnailUrl: null,
    durationSeconds: 20, publishedAt: "2026-08-20T00:00:00.000Z",
    views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0,
    engagementRate: 0, baselineMultiplier: 0, included: true,
    trackingState: "healthy", refreshedAt: null, error: null, sourceUrl: null,
    ...partial,
  };
}

describe("engagement totals", () => {
  it("splits engagement into its parts so comments can stand alone", () => {
    const totals = engagementTotals([
      video({ id: "a", likes: 10, comments: 4, shares: 2, bookmarks: 1 }),
      video({ id: "b", likes: 5, comments: 3, shares: 1, bookmarks: 0 }),
    ]);
    expect(totals).toEqual({ likes: 15, comments: 7, shares: 3, bookmarks: 1 });
    expect(totalInteractions(totals)).toBe(26);
  });

  it("omits warm-up and unpaid posts, matching how views and post counts are totalled", () => {
    const videos = [
      video({ id: "counted", comments: 9, included: true }),
      video({ id: "warmup", comments: 100, included: false }),
    ];
    expect(engagementTotals(videos).comments).toBe(9);
    // The live-provider path has no Result-side exclusions to honour yet.
    expect(engagementTotals(videos, { countAll: true }).comments).toBe(109);
  });

  it("returns zeroes rather than NaN when a creator has no videos", () => {
    expect(engagementTotals([])).toEqual({ likes: 0, comments: 0, shares: 0, bookmarks: 0 });
    expect(totalInteractions(engagementTotals([]))).toBe(0);
  });

  it("does not mutate the shared empty accumulator across calls", () => {
    engagementTotals([video({ comments: 5 })]);
    expect(engagementTotals([])).toEqual({ likes: 0, comments: 0, shares: 0, bookmarks: 0 });
  });
});
