import type { Client } from "discord.js";
import {
  activityEvents,
  creatorDiscord,
  creatorIdentityKey,
  getDatabase,
  organizations,
  reconcileLaunchpointDataset,
  signingRelationships,
  syncRuns,
  type LaunchpointSocialIdentityInput,
} from "@result/db";
import { and, eq } from "drizzle-orm";
import { getGuildState } from "../data/store.js";
import { LaunchpointAdapter, type LaunchpointPost } from "../integrations/launchpoint.js";

const adapter = new LaunchpointAdapter();

function socialIdentityFromPost(post: LaunchpointPost, creatorExternalId: string): LaunchpointSocialIdentityInput | null {
  if (!post.url) return null;
  try {
    const url = new URL(post.url);
    const platform = (post.platform ?? (url.hostname.includes("instagram") ? "instagram" : url.hostname.includes("tiktok") ? "tiktok" : url.hostname.includes("youtube") || url.hostname.includes("youtu.be") ? "youtube" : "")).toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let username: string | null = null;
    if (platform === "instagram" && parts[0] && !["p", "reel", "reels", "tv"].includes(parts[0].toLowerCase())) username = parts[0];
    if (platform === "tiktok" && parts[0]?.startsWith("@")) username = parts[0].slice(1);
    if (platform === "youtube" && parts[0]?.startsWith("@")) username = parts[0].slice(1);
    return username ? { creatorExternalId, platform, username: username.replace(/^@/, ""), url: post.url } : null;
  } catch {
    return null;
  }
}

export async function syncLaunchpointRelationships(client: Client): Promise<void> {
  if (!process.env.DATABASE_URL || !process.env.LAUNCHPOINT_API_KEY) return;
  for (const guild of client.guilds.cache.values()) {
    const db = getDatabase();
    const org = (await db.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.slug, "result"), eq(organizations.discordGuildId, guild.id))).limit(1))[0];
    if (!org) continue;
    const [run] = await db.insert(syncRuns).values({ organizationId: org.id, source: "launchpoint", state: "running" }).returning({ id: syncRuns.id });
    let seen = 0;
    let changed = 0;
    try {
      const legacy = await getGuildState(guild.id);
      for (const review of legacy.creatorReviews) {
        if (!review.launchpointCreatorId) continue;
        const discord = (await db.select({ creatorId: creatorDiscord.creatorId }).from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, org.id), eq(creatorDiscord.guildId, guild.id), eq(creatorDiscord.discordUserId, review.creatorId))).limit(1))[0];
        if (!discord) continue;
        const relationship = (await db.select({ id: signingRelationships.id }).from(signingRelationships).where(and(eq(signingRelationships.organizationId, org.id), eq(signingRelationships.provider, "launchpoint"), eq(signingRelationships.externalId, review.launchpointCreatorId))).limit(1))[0];
        if (!relationship) {
          await db.insert(signingRelationships).values({ organizationId: org.id, creatorId: discord.creatorId, provider: "launchpoint", syncMode: "api", externalId: review.launchpointCreatorId, state: "pending", sourceUrl: adapter.getDeepLink(review.launchpointCreatorId), verificationMethod: "migrated_bot_mapping", verifiedAt: new Date() });
          await db.insert(activityEvents).values({ organizationId: org.id, creatorId: discord.creatorId, type: "provider.mapping_migrated", summary: "Launchpoint mapping migrated from the Discord bot.", metadata: { provider: "launchpoint", externalId: review.launchpointCreatorId } });
          changed += 1;
        }
      }

      const [providerCreators, relationships, posts] = await Promise.all([adapter.listCreators(), adapter.listRelationshipRecords(), adapter.listPosts()]);
      const idsByName = new Map<string, Set<string>>();
      for (const creator of providerCreators) {
        for (const value of [creator.displayName, creator.username, creator.email]) {
          const key = creatorIdentityKey(value);
          if (!key) continue;
          const ids = idsByName.get(key) ?? new Set<string>();
          ids.add(creator.externalId);
          idsByName.set(key, ids);
        }
      }
      const socialIdentities = posts.flatMap((post) => {
        let creatorExternalId = post.creatorId ?? null;
        if (!creatorExternalId) {
          const key = creatorIdentityKey(post.contractorName);
          const candidates = key ? idsByName.get(key) : null;
          if (candidates?.size === 1) creatorExternalId = [...candidates][0]!;
        }
        if (!creatorExternalId) return [];
        const identity = socialIdentityFromPost(post, creatorExternalId);
        return identity ? [identity] : [];
      });
      const result = await reconcileLaunchpointDataset({ organizationId: org.id, creators: providerCreators, relationships, socialIdentities });
      seen = result.creatorsSeen;
      changed += result.changed;
      if (run) await db.update(syncRuns).set({ state: "succeeded", finishedAt: new Date(), recordsSeen: seen, recordsChanged: changed }).where(eq(syncRuns.id, run.id));
    } catch (error) {
      if (run) await db.update(syncRuns).set({ state: "failed", finishedAt: new Date(), recordsSeen: seen, recordsChanged: changed, error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run.id));
      throw error;
    }
  }
}
