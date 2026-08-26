import type { PortalVideo } from "./portal-types";

export type EngagementTotals = { likes: number; comments: number; shares: number; bookmarks: number };

const emptyEngagement: EngagementTotals = { likes: 0, comments: 0, shares: 0, bookmarks: 0 };

/**
 * Splits engagement into its parts for a set of videos, so a creator or account
 * can report comments on their own rather than only inside engagementRate.
 *
 * Warm-up and unpaid posts are excluded by default, matching how views and post
 * counts are totalled. `countAll` is for the live-provider path, which has no
 * Result-side exclusions to honour yet.
 */
export function engagementTotals(videos: PortalVideo[], options: { countAll?: boolean } = {}): EngagementTotals {
  return videos.reduce<EngagementTotals>((totals, video) => {
    if (!options.countAll && !video.included) return totals;
    return {
      likes: totals.likes + video.likes,
      comments: totals.comments + video.comments,
      shares: totals.shares + video.shares,
      bookmarks: totals.bookmarks + video.bookmarks,
    };
  }, emptyEngagement);
}

/** Total interactions, the numerator behind engagementRate. */
export function totalInteractions(totals: EngagementTotals): number {
  return totals.likes + totals.comments + totals.shares + totals.bookmarks;
}
