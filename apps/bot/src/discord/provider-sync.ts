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
} from "@result/db";
import { launchpointSocialIdentityFromPost } from "@result/domain";
import { and, eq } from "drizzle-orm";
import { getGuildState } from "../data/store.js";
import { LaunchpointAdapter } from "../integrations/launchpoint.js";

const adapter = new LaunchpointAdapter();

export type LaunchpointAssignmentResult = "synced" | "database_unavailable" | "organization_unavailable" | "discord_identity_unavailable";

export function launchpointAssignmentAction(existingCreatorId: string | null | undefined, targetCreatorId: string): "create" | "keep" | "move" {
  if (!existingCreatorId) return "create";
  return existingCreatorId === targetCreatorId ? "keep" : "move";
}

/**
 * Immediately applies an explicit manager mapping to the canonical creator graph.
 * The scheduled provider sweep still refreshes contract state and raw provider data.
 */
export async function persistLaunchpointAssignment(input: {
  guildId: string;
  discordUserId: string;
  launchpointCreatorId: string;
  launchpointCreatorName: string;
  assignedByDiscordUserId: string;
}): Promise<LaunchpointAssignmentResult> {
  if (!process.env.DATABASE_URL) return "database_unavailable";
  const db = getDatabase();
  const org = (await db.select({ id: organizations.id }).from(organizations).where(and(
    eq(organizations.slug, "result"),
    eq(organizations.discordGuildId, input.guildId),
  )).limit(1))[0];
  if (!org) return "organization_unavailable";
  const discord = (await db.select({ creatorId: creatorDiscord.creatorId }).from(creatorDiscord).where(and(
    eq(creatorDiscord.organizationId, org.id),
    eq(creatorDiscord.guildId, input.guildId),
    eq(creatorDiscord.discordUserId, input.discordUserId),
  )).limit(1))[0];
  if (!discord) return "discord_identity_unavailable";

  const existing = (await db.select({ id: signingRelationships.id, creatorId: signingRelationships.creatorId }).from(signingRelationships).where(and(
    eq(signingRelationships.organizationId, org.id),
    eq(signingRelationships.provider, "launchpoint"),
    eq(signingRelationships.externalId, input.launchpointCreatorId),
  )).limit(1))[0];
  const action = launchpointAssignmentAction(existing?.creatorId, discord.creatorId);
  const now = new Date();
  await db.transaction(async (tx) => {
    const values = {
      creatorId: discord.creatorId,
      syncMode: "api" as const,
      sourceUrl: adapter.getDeepLink(input.launchpointCreatorId),
      verificationMethod: "manager_discord_assignment",
      verifiedAt: now,
      lastError: null,
      updatedAt: now,
    };
    if (existing) {
      await tx.update(signingRelationships).set(values).where(and(
        eq(signingRelationships.id, existing.id),
        eq(signingRelationships.organizationId, org.id),
      ));
    } else {
      await tx.insert(signingRelationships).values({
        organizationId: org.id,
        provider: "launchpoint",
        externalId: input.launchpointCreatorId,
        state: "pending",
        ...values,
      });
    }
    await tx.insert(activityEvents).values({
      organizationId: org.id,
      creatorId: discord.creatorId,
      type: "provider.mapping_confirmed",
      summary: `Launchpoint identity ${input.launchpointCreatorName} was linked from Discord.`,
      metadata: {
        provider: "launchpoint",
        externalId: input.launchpointCreatorId,
        discordUserId: input.discordUserId,
        assignedByDiscordUserId: input.assignedByDiscordUserId,
        action,
        previousCreatorId: existing?.creatorId ?? null,
      },
    });
  });
  return "synced";
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
        const relationship = (await db.select({ id: signingRelationships.id, creatorId: signingRelationships.creatorId }).from(signingRelationships).where(and(eq(signingRelationships.organizationId, org.id), eq(signingRelationships.provider, "launchpoint"), eq(signingRelationships.externalId, review.launchpointCreatorId))).limit(1))[0];
        if (!relationship) {
          await db.insert(signingRelationships).values({ organizationId: org.id, creatorId: discord.creatorId, provider: "launchpoint", syncMode: "api", externalId: review.launchpointCreatorId, state: "pending", sourceUrl: adapter.getDeepLink(review.launchpointCreatorId), verificationMethod: "migrated_bot_mapping", verifiedAt: new Date() });
          await db.insert(activityEvents).values({ organizationId: org.id, creatorId: discord.creatorId, type: "provider.mapping_migrated", summary: "Launchpoint mapping migrated from the Discord bot.", metadata: { provider: "launchpoint", externalId: review.launchpointCreatorId } });
          changed += 1;
        } else if (relationship.creatorId !== discord.creatorId) {
          await db.update(signingRelationships).set({
            creatorId: discord.creatorId,
            verificationMethod: "migrated_bot_mapping",
            verifiedAt: new Date(),
            updatedAt: new Date(),
          }).where(and(eq(signingRelationships.id, relationship.id), eq(signingRelationships.organizationId, org.id)));
          await db.insert(activityEvents).values({
            organizationId: org.id,
            creatorId: discord.creatorId,
            type: "provider.mapping_migrated",
            summary: "Launchpoint mapping was moved onto the Discord-linked Result creator.",
            metadata: { provider: "launchpoint", externalId: review.launchpointCreatorId, previousCreatorId: relationship.creatorId },
          });
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
        const identity = launchpointSocialIdentityFromPost(post, creatorExternalId);
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
