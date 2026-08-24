import type { PerformancePoint, PortalVideo } from "./portal-types";

type PerformanceVideo = Pick<PortalVideo, "accountId" | "included" | "publishedAt" | "views" | "likes" | "comments" | "shares" | "bookmarks">;

export function buildPerformance(videos: PerformanceVideo[], days = 30, now = new Date()): PerformancePoint[] {
  const byDate = new Map<string, {
    views: number;
    posts: number;
    accounts: Set<string>;
    likes: number;
    comments: number;
    shares: number;
    bookmarks: number;
  }>();
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - i);
    byDate.set(date.toISOString().slice(0, 10), { views: 0, posts: 0, accounts: new Set(), likes: 0, comments: 0, shares: 0, bookmarks: 0 });
  }
  for (const video of videos) {
    if (!video.included || !video.publishedAt) continue;
    const point = byDate.get(video.publishedAt.slice(0, 10));
    if (!point) continue;
    point.views += video.views;
    point.posts += 1;
    point.accounts.add(video.accountId);
    point.likes += video.likes;
    point.comments += video.comments;
    point.shares += video.shares;
    point.bookmarks += video.bookmarks;
  }
  return [...byDate.entries()].map(([date, metrics]) => {
    const interactions = metrics.likes + metrics.comments + metrics.shares + metrics.bookmarks;
    return {
      date,
      views: metrics.views,
      posts: metrics.posts,
      activeAccounts: metrics.accounts.size,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: metrics.shares,
      bookmarks: metrics.bookmarks,
      engagementRate: metrics.views > 0 ? interactions / metrics.views : 0,
    };
  });
}
