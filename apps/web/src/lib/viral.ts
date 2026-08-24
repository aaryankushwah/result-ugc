import "server-only";

import { deriveAccountPerformanceHealth, deriveTrackingState } from "@result/domain";
import type { PortalAccount, PortalVideo } from "./portal-types";

const VIRAL_API_URL = "https://viral.app/api/v1";

type ViralList<T> = { data: T[]; pageCount: number; totalRows: number };

type ViralAccount = {
  id: string;
  platform: string;
  platformAccountId: string;
  username?: string | null;
  displayName?: string | null;
  profilePictureUrl?: string | null;
  followerCount?: number | null;
  followingCount?: number | null;
  totalVideosPublished?: number | null;
  p50Views?: number | null;
  daysSinceLastPost?: number | null;
  postActivity?: {
    dayCount: number;
    days: Array<{ date: string; postedVideos: number }>;
  } | null;
  weeklyViewStats?: {
    weeks: Array<{ weekStart: string; avgViews: number | null; p50Views: number | null }>;
  } | null;
  totalViews?: number | null;
  totalLikes?: number | null;
  totalComments?: number | null;
  totalShares?: number | null;
  totalBookmarks?: number | null;
  averageViewsPerVideo?: number | null;
  engagementRate?: number | null;
  latestVideoPublishedAt?: string | null;
  loadAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorCode?: string | null;
};

type ViralVideo = {
  id: string;
  orgAccountId: string;
  platform: string;
  platformAccountId: string;
  platformVideoId: string;
  accountUsername?: string | null;
  caption?: string | null;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  publishedAt?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  commentCount?: number | null;
  shareCount?: number | null;
  bookmarkCount?: number | null;
  engagementRate?: number | null;
  viralityFactor?: number | null;
  loadAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorCode?: string | null;
};

type ViralExcludedVideo = {
  id: string;
  orgAccountId: string;
  platform: string;
  platformAccountId: string;
  platformVideoId: string;
  username?: string | null;
  caption?: string | null;
  thumbnailUrl?: string | null;
  createdAt?: string | null;
};

async function viralFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.VIRAL_APP_API_KEY;
  if (!apiKey) throw new Error("Viral API is not configured");
  const response = await fetch(`${VIRAL_API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      ...init?.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Viral returned ${response.status}: ${body.slice(0, 180)}`);
  }
  return response.json() as Promise<T>;
}

export async function getLiveViralData(): Promise<{ accounts: PortalAccount[]; videos: PortalVideo[] }> {
  const [accountList, videoList, excludedList] = await Promise.all([
    viralFetch<ViralList<ViralAccount>>("/accounts?perPage=100&sortCol=totalViews&sortDir=desc"),
    viralFetch<ViralList<ViralVideo>>("/videos?perPage=100&sortCol=publishedAt&sortDir=desc"),
    viralFetch<ViralList<ViralExcludedVideo>>("/videos/excluded?perPage=100&sortCol=publishedAt&sortDir=desc"),
  ]);
  const accountIds = new Set(accountList.data.map((account) => account.id));
  const includedVideos = videoList.data.filter((video) => accountIds.has(video.orgAccountId)).map(mapVideo);
  const includedKeys = new Set(includedVideos.map((video) => `${video.platform}:${video.platformVideoId}`));
  const excludedVideos = excludedList.data
    .filter((video) => accountIds.has(video.orgAccountId) && !includedKeys.has(`${video.platform}:${video.platformVideoId}`))
    .map(mapExcludedVideo);
  const videos = [...includedVideos, ...excludedVideos];
  const videosByAccount = new Map<string, PortalVideo[]>();
  for (const video of videos) videosByAccount.set(video.accountId, [...(videosByAccount.get(video.accountId) ?? []), video]);
  const accounts = accountList.data.map((account) => mapAccount(account, videosByAccount.get(account.id) ?? []));
  return { accounts, videos };
}

export async function trackViralAccounts(accounts: Array<{ platform: string; username: string; maxVideos?: number }>): Promise<unknown> {
  if (!accounts.length) return { count: 0 };
  return viralFetch("/accounts/tracked", {
    method: "POST",
    body: JSON.stringify({
      isCompetitor: false,
      accounts: accounts.map((account) => ({
        platform: account.platform.toLowerCase(),
        username: account.username.replace(/^@/, ""),
        max_videos: account.maxVideos ?? 100,
      })),
    }),
  });
}

function mapAccount(account: ViralAccount, accountVideos: PortalVideo[]): PortalAccount {
  const username = account.username ?? "unknown";
  const performanceHealth = deriveAccountPerformanceHealth({ videos: accountVideos });
  return {
    id: account.id,
    creatorId: null,
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    username,
    displayName: account.displayName ?? account.username ?? "Unknown account",
    avatarUrl: account.profilePictureUrl ?? null,
    followers: account.followerCount ?? null,
    following: account.followingCount ?? null,
    posts: account.totalVideosPublished ?? 0,
    views: account.totalViews ?? 0,
    likes: account.totalLikes ?? 0,
    comments: account.totalComments ?? 0,
    shares: account.totalShares ?? 0,
    bookmarks: account.totalBookmarks ?? 0,
    averageViews: account.averageViewsPerVideo ?? 0,
    engagementRate: account.engagementRate ?? 0,
    latestPostAt: account.latestVideoPublishedAt ?? null,
    performanceHealth: performanceHealth.state,
    performanceHealthReason: performanceHealth.reason,
    warmedUp: performanceHealth.warmedUp,
    trackedPosts: performanceHealth.trackedPosts,
    warmupPosts: performanceHealth.warmupPosts,
    recentPosts7d: performanceHealth.recentPosts,
    recentMedianViews: performanceHealth.recentMedianViews,
    baselineMedianViews: performanceHealth.baselineMedianViews,
    trackingState: deriveTrackingState({ loadAt: account.loadAt, lastErrorAt: account.lastErrorAt, staleAfterMinutes: 2_160 }),
    refreshedAt: account.loadAt ?? null,
    linkState: "unlinked",
    error: account.lastErrorCode ?? null,
    sourceUrl: account.platform.toLowerCase() === "instagram" ? `https://www.instagram.com/${username}/`
      : account.platform.toLowerCase() === "tiktok" ? `https://www.tiktok.com/@${username}`
        : account.platform.toLowerCase() === "youtube" ? `https://www.youtube.com/@${username}` : null,
  };
}

function mapVideo(video: ViralVideo): PortalVideo {
  return {
    id: video.id,
    accountId: video.orgAccountId,
    creatorId: null,
    platform: video.platform,
    platformAccountId: video.platformAccountId,
    platformVideoId: video.platformVideoId,
    accountUsername: video.accountUsername ?? "unknown",
    caption: video.caption ?? "Untitled video",
    thumbnailUrl: video.thumbnailUrl ?? null,
    durationSeconds: video.durationSeconds ?? null,
    publishedAt: video.publishedAt ?? null,
    views: video.viewCount ?? 0,
    likes: video.likeCount ?? 0,
    comments: video.commentCount ?? 0,
    shares: video.shareCount ?? 0,
    bookmarks: video.bookmarkCount ?? 0,
    engagementRate: video.engagementRate ?? 0,
    baselineMultiplier: video.viralityFactor ?? 0,
    included: true,
    trackingState: deriveTrackingState({ loadAt: video.loadAt, lastErrorAt: video.lastErrorAt, staleAfterMinutes: 2_160 }),
    refreshedAt: video.loadAt ?? null,
    error: video.lastErrorCode ?? null,
    sourceUrl: video.platform.toLowerCase() === "instagram" ? `https://www.instagram.com/reel/${video.platformVideoId}/`
      : video.platform.toLowerCase() === "tiktok" ? `https://www.tiktok.com/@${video.accountUsername ?? "unknown"}/video/${video.platformVideoId}`
        : video.platform.toLowerCase() === "youtube" ? `https://www.youtube.com/watch?v=${video.platformVideoId}` : null,
  };
}

function mapExcludedVideo(video: ViralExcludedVideo): PortalVideo {
  return {
    id: video.id,
    accountId: video.orgAccountId,
    creatorId: null,
    platform: video.platform,
    platformAccountId: video.platformAccountId,
    platformVideoId: video.platformVideoId,
    accountUsername: video.username ?? "unknown",
    caption: video.caption ?? "Excluded video",
    thumbnailUrl: video.thumbnailUrl ?? null,
    durationSeconds: null,
    publishedAt: null,
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    bookmarks: 0,
    engagementRate: 0,
    baselineMultiplier: 0,
    included: false,
    trackingState: "healthy",
    refreshedAt: video.createdAt ?? null,
    error: null,
    sourceUrl: video.platform.toLowerCase() === "instagram" ? `https://www.instagram.com/reel/${video.platformVideoId}/`
      : video.platform.toLowerCase() === "tiktok" ? `https://www.tiktok.com/@${video.username ?? "unknown"}/video/${video.platformVideoId}`
        : video.platform.toLowerCase() === "youtube" ? `https://www.youtube.com/watch?v=${video.platformVideoId}` : null,
  };
}

export async function excludeViralVideos(entries: Array<{ accountId: string; platform: string; platformAccountId: string; platformVideoId: string }>): Promise<unknown> {
  return viralFetch("/videos/excluded", { method: "POST", body: JSON.stringify({ entries: entries.map((entry) => ({ orgAccountId: entry.accountId, platform: entry.platform, platformAccountId: entry.platformAccountId, platformVideoId: entry.platformVideoId })) }) });
}

export async function restoreViralVideos(videos: Array<{ platform: string; platformVideoId: string }>): Promise<unknown> {
  return viralFetch("/videos/excluded/restore", { method: "POST", body: JSON.stringify({ videos }) });
}
