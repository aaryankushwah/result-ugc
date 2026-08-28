import "server-only";

import { creatorIdentityKey, getDatabase, organizations, reconcileCreator360, signingRelationships, socialAccounts, syncRuns, videos } from "@result/db";
import { eq } from "drizzle-orm";
import { getLiveViralData, trackViralAccounts } from "./viral";
import { syncCompletionState } from "./sync-state";

type SocialIdentity = { platform: string; username: string };

function providerSocialIdentities(raw: Record<string, unknown> | null): SocialIdentity[] {
  const identities = Array.isArray(raw?.socialIdentities) ? raw.socialIdentities : [];
  return identities.flatMap((identity) => {
    if (!identity || typeof identity !== "object" || Array.isArray(identity)) return [];
    const record = identity as Record<string, unknown>;
    const platform = typeof record.platform === "string" ? record.platform.toLowerCase() : "";
    const username = typeof record.username === "string" ? record.username.replace(/^@/, "").trim() : "";
    return ["facebook", "instagram", "tiktok", "youtube", "snapchat"].includes(platform) && username ? [{ platform, username }] : [];
  });
}

export async function syncViralSnapshots(): Promise<{ accounts: number; videos: number; tracked: number; linked: number; trackingError: string | null }> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const db = getDatabase();
  let organization = (await db.select().from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (!organization) [organization] = await db.insert(organizations).values({ slug: "result", name: "Result", discordGuildId: process.env.DISCORD_GUILD_ID ?? null }).returning();
  if (!organization) throw new Error("Could not initialize Result organization");
  const [run] = await db.insert(syncRuns).values({ organizationId: organization.id, source: "viral", state: "running" }).returning({ id: syncRuns.id });
  try {
    let live = await getLiveViralData();
    const providerRows = await db.select({ raw: signingRelationships.raw }).from(signingRelationships).where(eq(signingRelationships.organizationId, organization.id));
    const existing = new Set(live.accounts.map((account) => `${account.platform.toLowerCase()}:${creatorIdentityKey(account.username)}`));
    const discovered = new Map<string, SocialIdentity>();
    for (const row of providerRows) {
      for (const identity of providerSocialIdentities(row.raw)) {
        const key = `${identity.platform}:${creatorIdentityKey(identity.username)}`;
        if (!existing.has(key)) discovered.set(key, identity);
      }
    }
    let tracked = 0;
    let trackingError: string | null = null;
    if (discovered.size) {
      try {
        await trackViralAccounts([...discovered.values()]);
        tracked = discovered.size;
        live = await getLiveViralData();
      } catch (error) {
        trackingError = error instanceof Error ? error.message : String(error);
      }
    }
    await Promise.all(live.accounts.map((account) => db.insert(socialAccounts).values({ organizationId: organization.id, viralOrgAccountId: account.id, platform: account.platform, platformAccountId: account.platformAccountId, username: account.username, displayName: account.displayName, avatarUrl: account.avatarUrl, trackingState: account.trackingState, followers: account.followers, following: account.following, posts: account.posts, views: account.views, likes: account.likes, comments: account.comments, shares: account.shares, bookmarks: account.bookmarks, averageViews: account.averageViews, engagementRate: account.engagementRate, latestPostAt: account.latestPostAt ? new Date(account.latestPostAt) : null, sourceRefreshedAt: account.refreshedAt ? new Date(account.refreshedAt) : null, lastError: account.error, raw: account }).onConflictDoUpdate({ target: [socialAccounts.organizationId, socialAccounts.viralOrgAccountId], set: { platform: account.platform, platformAccountId: account.platformAccountId, username: account.username, displayName: account.displayName, avatarUrl: account.avatarUrl, trackingState: account.trackingState, followers: account.followers, following: account.following, posts: account.posts, views: account.views, likes: account.likes, comments: account.comments, shares: account.shares, bookmarks: account.bookmarks, averageViews: account.averageViews, engagementRate: account.engagementRate, latestPostAt: account.latestPostAt ? new Date(account.latestPostAt) : null, sourceRefreshedAt: account.refreshedAt ? new Date(account.refreshedAt) : null, lastError: account.error, raw: account, updatedAt: new Date() } })));
    const storedAccounts = await db.select({ id: socialAccounts.id, viralId: socialAccounts.viralOrgAccountId }).from(socialAccounts).where(eq(socialAccounts.organizationId, organization.id));
    const accountByViralId = new Map(storedAccounts.map((account) => [account.viralId, account.id]));
    await Promise.all(live.videos.map((video) => {
      const accountId = accountByViralId.get(video.accountId);
      if (!accountId) return Promise.resolve();
      return db.insert(videos).values({ organizationId: organization.id, accountId, viralVideoId: video.id, platformVideoId: video.platformVideoId, caption: video.caption, thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds, publishedAt: video.publishedAt ? new Date(video.publishedAt) : null, views: video.views, likes: video.likes, comments: video.comments, shares: video.shares, bookmarks: video.bookmarks, engagementRate: video.engagementRate, baselineMultiplier: video.baselineMultiplier, included: video.included, trackingState: video.trackingState, sourceRefreshedAt: video.refreshedAt ? new Date(video.refreshedAt) : null, lastError: video.error, raw: video }).onConflictDoUpdate({ target: [videos.organizationId, videos.viralVideoId], set: { accountId, caption: video.caption, thumbnailUrl: video.thumbnailUrl, durationSeconds: video.durationSeconds, publishedAt: video.publishedAt ? new Date(video.publishedAt) : null, views: video.views, likes: video.likes, comments: video.comments, shares: video.shares, bookmarks: video.bookmarks, engagementRate: video.engagementRate, baselineMultiplier: video.baselineMultiplier, included: video.included, trackingState: video.trackingState, sourceRefreshedAt: video.refreshedAt ? new Date(video.refreshedAt) : null, lastError: video.error, raw: video, updatedAt: new Date() } });
    }));
    const linked = await reconcileCreator360(organization.id);
    if (run) await db.update(syncRuns).set({ state: syncCompletionState(trackingError), finishedAt: new Date(), recordsSeen: live.accounts.length + live.videos.length, recordsChanged: live.accounts.length + live.videos.length + linked + tracked, error: trackingError }).where(eq(syncRuns.id, run.id));
    return { accounts: live.accounts.length, videos: live.videos.length, tracked, linked, trackingError };
  } catch (error) {
    if (run) await db.update(syncRuns).set({ state: "failed", finishedAt: new Date(), error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run.id));
    throw error;
  }
}
