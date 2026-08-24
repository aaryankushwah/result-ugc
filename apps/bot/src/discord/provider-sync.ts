import type { Client } from "discord.js";
import { activityEvents, creatorDiscord, getDatabase, organizations, signingRelationships, syncRuns } from "@result/db";
import { and, eq } from "drizzle-orm";
import { getGuildState } from "../data/store.js";
import { LaunchpointAdapter } from "../integrations/launchpoint.js";

const adapter = new LaunchpointAdapter();

export async function syncLaunchpointRelationships(client: Client): Promise<void> {
  if (!process.env.DATABASE_URL || !process.env.LAUNCHPOINT_API_KEY) return;
  for (const guild of client.guilds.cache.values()) {
    const org = (await getDatabase().select({ id: organizations.id }).from(organizations).where(and(eq(organizations.slug, "result"), eq(organizations.discordGuildId, guild.id))).limit(1))[0];
    if (!org) continue;
    const run = await getDatabase().insert(syncRuns).values({ organizationId: org.id, source: "launchpoint", state: "running" }).returning({ id: syncRuns.id });
    let seen = 0; let changed = 0;
    try {
      const legacy = await getGuildState(guild.id);
      for (const review of legacy.creatorReviews) {
        if (!review.launchpointCreatorId) continue;
        const discord = (await getDatabase().select({ creatorId: creatorDiscord.creatorId }).from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, org.id), eq(creatorDiscord.guildId, guild.id), eq(creatorDiscord.discordUserId, review.creatorId))).limit(1))[0];
        if (!discord) continue;
        const relationship = (await getDatabase().select({ id: signingRelationships.id }).from(signingRelationships).where(and(eq(signingRelationships.organizationId, org.id), eq(signingRelationships.provider, "launchpoint"), eq(signingRelationships.externalId, review.launchpointCreatorId))).limit(1))[0];
        if (!relationship) {
          await getDatabase().insert(signingRelationships).values({ organizationId: org.id, creatorId: discord.creatorId, provider: "launchpoint", syncMode: "api", externalId: review.launchpointCreatorId, state: "pending", sourceUrl: adapter.getDeepLink(review.launchpointCreatorId), verificationMethod: "migrated_bot_mapping", verifiedAt: new Date() });
          await getDatabase().insert(activityEvents).values({ organizationId: org.id, creatorId: discord.creatorId, type: "provider.mapping_migrated", summary: "Launchpoint mapping migrated from the Discord bot.", metadata: { provider: "launchpoint", externalId: review.launchpointCreatorId } });
          changed += 1;
        }
      }
      const mappings = await getDatabase().select().from(signingRelationships).where(and(eq(signingRelationships.organizationId, org.id), eq(signingRelationships.provider, "launchpoint"), eq(signingRelationships.syncMode, "api")));
      for (const mapping of mappings) {
        if (!mapping.externalId) continue;
        seen += 1;
        try {
          const [creator, relationships] = await Promise.all([adapter.getCreator(mapping.externalId), adapter.getRelationships(mapping.externalId)]);
          const current = relationships[0];
          await getDatabase().update(signingRelationships).set({ program: current?.program ?? mapping.program, state: current?.state ?? "pending", startsAt: current?.startsAt ? new Date(current.startsAt) : mapping.startsAt, endsAt: current?.endsAt ? new Date(current.endsAt) : mapping.endsAt, sourceUrl: current?.sourceUrl ?? adapter.getDeepLink(mapping.externalId), lastSyncedAt: new Date(), lastError: null, raw: { creator, relationships }, updatedAt: new Date() }).where(eq(signingRelationships.id, mapping.id));
          changed += 1;
        } catch (error) {
          await getDatabase().update(signingRelationships).set({ state: "sync_issue", lastError: error instanceof Error ? error.message : String(error), updatedAt: new Date() }).where(eq(signingRelationships.id, mapping.id));
        }
      }
      if (run[0]) await getDatabase().update(syncRuns).set({ state: "succeeded", finishedAt: new Date(), recordsSeen: seen, recordsChanged: changed }).where(eq(syncRuns.id, run[0].id));
    } catch (error) {
      if (run[0]) await getDatabase().update(syncRuns).set({ state: "failed", finishedAt: new Date(), recordsSeen: seen, recordsChanged: changed, error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run[0].id));
      throw error;
    }
  }
}
