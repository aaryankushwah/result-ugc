import "server-only";

import { getDatabase, organizations, socialAccounts, syncRuns, videos } from "@result/db";
import { eq } from "drizzle-orm";
import { getLiveViralData } from "./viral";

export async function syncViralSnapshots(): Promise<{ accounts: number; videos: number }> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const db = getDatabase();
  let organization = (await db.select().from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (!organization) [organization] = await db.insert(organizations).values({ slug: "result", name: "Result", discordGuildId: process.env.DISCORD_GUILD_ID ?? null }).returning();
  if (!organization) throw new Error("Could not initialize Result organization");
  const [run] = await db.insert(syncRuns).values({ organizationId: organization.id, source: "viral", state: "running" }).returning({ id: syncRuns.id });
  try {
    const live = await getLiveViralData();
    for (const account of live.accounts) {
      await db.insert(socialAccounts).values({ organizationId: organization.id, viralOrgAccountId: account.id, platform: account.platform, platformAccountId: account.platformAccountId, username: account.username, displayName: account.displayName, avatarUrl: account.avatarUrl, trackingState: account.trackingState, followers: account.followers, following: account.following, posts: account.posts, views: account.views, likes: account.likes, comments: account.comments, shares: account.shares, bookmarks: account.bookmarks, averageViews: account.averageViews, engagementRate: account.engagementRate, latestPostAt: account.latestPostAt ? new Date(account.latestPostAt) : null, sourceRefreshedAt: account.refreshedAt ? new Date(account.refreshedAt) : null, lastError: account.error, raw: account }).onConflictDoUpdate({ target: [socialAccounts.organizationId, socialAccounts.viralOrgAccountId], set: { platform: account.platform, platformAccountId: account.platformAccountId, username: account.username, displayName: account.displayName, avatarUrl: account.avatarUrl, trackingState: account.trackingState, followers: account.followers, following: account.following, posts: account.posts, views: account.views, likes: account.likes, comments: account.comments, shares: account.shares, bookmarks: account.bookmarks, averageViews: account.averageViews, engagementRate: account.engagementRate, latestPostAt: account.latestPostAt ? new Date(account.latestPostAt) : null, sourceRefreshedAt: account.refreshedAt ? new Date(account.refreshedAt) : null, lastError: account.error, raw: account, updatedAt: new Date() } });
    }
    const storedAccounts = await db.select({ id: socialAccounts.id, viralId: socialAccounts.viralOrgAccountId }).from(socialAccounts).where(eq(socialAccounts.organizationId, organization.id));
    const accountByViralId = new Map(storedAccounts.map((account) => [account.viralId, account.id]));
    for (const video of live.videos) {
      const accountId = accountByViralId.get(video.accountId); if (!accountId) continue;
      await db.insert(videos).values({ organizationId: organization.id, accountId, viralVideoId: video.id, platformVideoId: video.platformVideoId, caption: video.caption, thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds, publishedAt: video.publishedAt ? new Date(video.publishedAt) : null, views: video.views, likes: video.likes, comments: video.comments, shares: video.shares, bookmarks: video.bookmarks, engagementRate: video.engagementRate, baselineMultiplier: video.baselineMultiplier, included: video.included, trackingState: video.trackingState, sourceRefreshedAt: video.refreshedAt ? new Date(video.refreshedAt) : null, lastError: video.error, raw: video }).onConflictDoUpdate({ target: [videos.organizationId, videos.viralVideoId], set: { accountId, caption: video.caption, thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds, publishedAt: video.publishedAt ? new Date(video.publishedAt) : null, views: video.views, likes: video.likes, comments: video.comments, shares: video.shares, bookmarks: video.bookmarks, engagementRate: video.engagementRate, baselineMultiplier: video.baselineMultiplier, included: video.included, trackingState: video.trackingState, sourceRefreshedAt: video.refreshedAt ? new Date(video.refreshedAt) : null, lastError: video.error, raw: video, updatedAt: new Date() } });
    }
    if (run) await db.update(syncRuns).set({ state: "succeeded", finishedAt: new Date(), recordsSeen: live.accounts.length + live.videos.length, recordsChanged: live.accounts.length + live.videos.length }).where(eq(syncRuns.id, run.id));
    return { accounts: live.accounts.length, videos: live.videos.length };
  } catch (error) {
    if (run) await db.update(syncRuns).set({ state: "failed", finishedAt: new Date(), error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run.id));
    throw error;
  }
}
