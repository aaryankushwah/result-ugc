import type { PortalCreator, PortalVideo } from "@/lib/portal-types";

/**
 * Chart series for one creator, derived from the video snapshot.
 *
 * Excluded videos are warm-up / unpaid content and are omitted from Result
 * performance totals, so every series here counts included videos only.
 */

export type CreatorDailyPoint = { date: string; views: number; posts: number; engagementRate: number };
export type CreatorPostPoint = { label: string; views: number; multiplier: number; publishedAt: string | null };
export type CreatorAccountPoint = { account: string; views: number; posts: number };

function countedVideos(videos: PortalVideo[], creator: PortalCreator): PortalVideo[] {
  const accountIds = new Set(creator.accounts.map((account) => account.id));
  return videos.filter((video) => video.included && accountIds.has(video.accountId));
}

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** One row per day for the trailing window, including days with no posts. */
export function creatorDailySeries(creator: PortalCreator, videos: PortalVideo[], days = 30, now = new Date()): CreatorDailyPoint[] {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - 1 - index));
    return { date: dayKey(date), views: 0, posts: 0, engagementRate: 0 };
  });
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const engagementByDate = new Map<string, { engagements: number; views: number }>();
  for (const video of countedVideos(videos, creator)) {
    if (!video.publishedAt) continue;
    const row = byDate.get(video.publishedAt.slice(0, 10));
    if (!row) continue;
    row.views += video.views;
    row.posts += 1;
    const totals = engagementByDate.get(row.date) ?? { engagements: 0, views: 0 };
    totals.engagements += video.likes + video.comments + video.shares + video.bookmarks;
    totals.views += video.views;
    engagementByDate.set(row.date, totals);
  }
  // Rate of the day's totals, not the mean of per-video rates: a 10-view post
  // must not swing the day as hard as a 10,000-view one.
  for (const row of rows) {
    const totals = engagementByDate.get(row.date);
    row.engagementRate = totals && totals.views ? (totals.engagements / totals.views) * 100 : 0;
  }
  return rows;
}

/** Median views across counted posts — the line a new post has to beat. */
export function creatorBaselineViews(creator: PortalCreator, videos: PortalVideo[]): number {
  const views = countedVideos(videos, creator).map((video) => video.views).sort((a, b) => a - b);
  if (!views.length) return 0;
  const middle = Math.floor(views.length / 2);
  return views.length % 2 ? views[middle]! : Math.round((views[middle - 1]! + views[middle]!) / 2);
}

/** The most recent counted posts, oldest first so the chart reads left to right. */
export function creatorRecentPosts(creator: PortalCreator, videos: PortalVideo[], limit = 12): CreatorPostPoint[] {
  return countedVideos(videos, creator)
    .filter((video) => video.publishedAt)
    .sort((a, b) => (a.publishedAt! < b.publishedAt! ? 1 : a.publishedAt! > b.publishedAt! ? -1 : 0))
    .slice(0, limit)
    .reverse()
    .map((video) => ({
      label: video.caption.trim().slice(0, 28) || video.platformVideoId,
      views: video.views,
      multiplier: video.baselineMultiplier,
      publishedAt: video.publishedAt,
    }));
}

/** Where the reach actually comes from, biggest account first. */
export function creatorAccountTotals(creator: PortalCreator, videos: PortalVideo[]): CreatorAccountPoint[] {
  const counted = countedVideos(videos, creator);
  return creator.accounts
    .map((account) => {
      const owned = counted.filter((video) => video.accountId === account.id);
      // The same handle is often reused across platforms, so the platform is part of the identity.
      return { account: `@${account.username} · ${account.platform}`, views: owned.reduce((sum, video) => sum + video.views, 0), posts: owned.length };
    })
    .filter((row) => row.posts > 0)
    .sort((a, b) => b.views - a.views);
}

/**
 * Categorical slots are assigned in fixed order and never cycled, so anything
 * past the palette folds into a single "Other" row rather than reusing a hue.
 */
export function foldAccountTail(rows: CreatorAccountPoint[], limit = 6): CreatorAccountPoint[] {
  if (rows.length <= limit) return rows;
  const tail = rows.slice(limit);
  return [...rows.slice(0, limit), {
    account: `Other (${tail.length} accounts)`,
    views: tail.reduce((sum, row) => sum + row.views, 0),
    posts: tail.reduce((sum, row) => sum + row.posts, 0),
  }];
}

export function hasCreatorSeriesData(rows: Array<{ views: number }>): boolean {
  return rows.some((row) => row.views > 0);
}
