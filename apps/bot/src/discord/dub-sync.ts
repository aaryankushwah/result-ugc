import type { Client, TextBasedChannel } from "discord.js";
import {
  activityEvents,
  attributionDailySnapshots,
  creatorAttributionLinks,
  creatorDiscord,
  creators,
  getDatabase,
  organizations,
  syncRuns,
} from "@result/db";
import { and, eq } from "drizzle-orm";
import { creatorDubExternalId, creatorDubKey, getDubLink, issueDubLink, type DubLinkSnapshot } from "../integrations/dub.js";

const SYNC_INTERVAL_MS = 15 * 60 * 1_000;

function utcDay(value = new Date()): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export async function resolveDubCreator(guildId: string, discordUserId: string): Promise<{ organizationId: string; creatorId: string; creatorName: string } | null> {
  if (!process.env.DATABASE_URL) return null;
  const db = getDatabase();
  const connection = (await db.select({ organizationId: creatorDiscord.organizationId, creatorId: creatorDiscord.creatorId }).from(creatorDiscord).where(and(eq(creatorDiscord.guildId, guildId), eq(creatorDiscord.discordUserId, discordUserId))).limit(1))[0];
  if (!connection) return null;
  const creator = (await db.select({ displayName: creators.displayName }).from(creators).where(eq(creators.id, connection.creatorId)).limit(1))[0];
  if (!creator) return null;
  return { organizationId: connection.organizationId, creatorId: connection.creatorId, creatorName: creator.displayName };
}

export async function persistDubLinkSnapshot(input: { organizationId: string; creatorId: string; snapshot: DubLinkSnapshot }): Promise<string> {
  const db = getDatabase();
  const refreshedAt = new Date();
  const [saved] = await db.insert(creatorAttributionLinks).values({
    organizationId: input.organizationId,
    creatorId: input.creatorId,
    providerLinkId: input.snapshot.id,
    externalId: input.snapshot.externalId,
    shortLink: input.snapshot.shortLink,
    destinationUrl: input.snapshot.destinationUrl,
    linkKey: input.snapshot.key ?? null,
    state: "active",
    clicks: input.snapshot.clicks,
    leads: input.snapshot.leads,
    conversions: input.snapshot.conversions,
    sales: input.snapshot.sales,
    saleAmount: input.snapshot.saleAmount,
    lastClickedAt: input.snapshot.lastClickedAt ? new Date(input.snapshot.lastClickedAt) : null,
    sourceRefreshedAt: refreshedAt,
    lastErrorAt: null,
    lastError: null,
    raw: input.snapshot.raw,
  }).onConflictDoUpdate({
    target: [creatorAttributionLinks.organizationId, creatorAttributionLinks.creatorId],
    set: {
      providerLinkId: input.snapshot.id,
      externalId: input.snapshot.externalId,
      shortLink: input.snapshot.shortLink,
      destinationUrl: input.snapshot.destinationUrl,
      linkKey: input.snapshot.key ?? null,
      state: "active",
      clicks: input.snapshot.clicks,
      leads: input.snapshot.leads,
      conversions: input.snapshot.conversions,
      sales: input.snapshot.sales,
      saleAmount: input.snapshot.saleAmount,
      lastClickedAt: input.snapshot.lastClickedAt ? new Date(input.snapshot.lastClickedAt) : null,
      sourceRefreshedAt: refreshedAt,
      lastErrorAt: null,
      lastError: null,
      raw: input.snapshot.raw,
      updatedAt: refreshedAt,
    },
  }).returning({ id: creatorAttributionLinks.id });
  if (!saved) throw new Error("Could not save the creator's Dub link.");
  await saveSnapshot({ organizationId: input.organizationId, creatorId: input.creatorId, attributionLinkId: saved.id, snapshot: input.snapshot, refreshedAt });
  return saved.id;
}

async function saveSnapshot(input: {
  organizationId: string;
  creatorId: string;
  attributionLinkId: string;
  snapshot: DubLinkSnapshot;
  refreshedAt: Date;
}): Promise<void> {
  const db = getDatabase();
  await db.insert(attributionDailySnapshots).values({
    organizationId: input.organizationId,
    creatorId: input.creatorId,
    attributionLinkId: input.attributionLinkId,
    bucketAt: utcDay(input.refreshedAt),
    clicks: input.snapshot.clicks,
    leads: input.snapshot.leads,
    conversions: input.snapshot.conversions,
    sales: input.snapshot.sales,
    saleAmount: input.snapshot.saleAmount,
    sourceRefreshedAt: input.refreshedAt,
    raw: input.snapshot.raw,
  }).onConflictDoUpdate({
    target: [attributionDailySnapshots.attributionLinkId, attributionDailySnapshots.bucketAt],
    set: {
      clicks: input.snapshot.clicks,
      leads: input.snapshot.leads,
      conversions: input.snapshot.conversions,
      sales: input.snapshot.sales,
      saleAmount: input.snapshot.saleAmount,
      sourceRefreshedAt: input.refreshedAt,
      raw: input.snapshot.raw,
      updatedAt: input.refreshedAt,
    },
  });
}

async function notifyCreator(client: Client, channelId: string | null, shortLink: string): Promise<void> {
  if (!channelId) throw new Error("Creator does not have a private Discord channel.");
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !("send" in channel)) throw new Error("Creator Discord channel is unavailable.");
  await (channel as TextBasedChannel & { send: (value: string) => Promise<unknown> }).send(
    `Your Result attribution link is ready: ${shortLink}\n\nUse this link anywhere you send viewers to Result. Clicks and conversions will be attributed to you automatically.`,
  );
}

export async function syncDubAttribution(client: Client): Promise<void> {
  const destinationUrl = process.env.DUB_DEFAULT_URL?.trim();
  if (!process.env.DATABASE_URL || !process.env.DUB_API_KEY || !destinationUrl) return;
  const db = getDatabase();
  for (const guild of client.guilds.cache.values()) {
    const organization = (await db.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.slug, "result"), eq(organizations.discordGuildId, guild.id))).limit(1))[0];
    if (!organization) continue;
    const [run] = await db.insert(syncRuns).values({ organizationId: organization.id, source: "dub", state: "running" }).returning({ id: syncRuns.id });
    let seen = 0;
    let changed = 0;
    const errors: string[] = [];
    try {
      const [creatorRows, connectionRows, linkRows] = await Promise.all([
        db.select({ id: creators.id, displayName: creators.displayName }).from(creators).where(and(eq(creators.organizationId, organization.id), eq(creators.lifecycle, "active"))),
        db.select().from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, organization.id), eq(creatorDiscord.guildId, guild.id))),
        db.select().from(creatorAttributionLinks).where(eq(creatorAttributionLinks.organizationId, organization.id)),
      ]);
      const connectionByCreator = new Map(connectionRows.map((row) => [row.creatorId, row]));
      const linkByCreator = new Map(linkRows.map((row) => [row.creatorId, row]));
      for (const creator of creatorRows) {
        const connection = connectionByCreator.get(creator.id);
        seen += 1;
        try {
          const existing = linkByCreator.get(creator.id);
          const snapshot = existing
            ? await getDubLink(existing.providerLinkId)
            : await issueDubLink({
              creatorId: creator.id,
              creatorName: creator.displayName,
              destinationUrl,
              externalId: creatorDubExternalId(creator.id),
              key: creatorDubKey(connection?.username ?? creator.displayName, creator.id),
            });
          if (!snapshot.destinationUrl) snapshot.destinationUrl = destinationUrl;
          await persistDubLinkSnapshot({ organizationId: organization.id, creatorId: creator.id, snapshot });
          if (!existing) {
            changed += 1;
            await db.insert(activityEvents).values({ organizationId: organization.id, creatorId: creator.id, type: "attribution.link_created", summary: "Dub attribution link created.", metadata: { provider: "dub", linkId: snapshot.id, shortLink: snapshot.shortLink } });
          }
          if (connection?.privateChannelId && !existing?.discordDeliveredAt) {
            await notifyCreator(client, connection.privateChannelId, snapshot.shortLink).then(async () => {
              await db.update(creatorAttributionLinks).set({ discordDeliveredAt: new Date(), updatedAt: new Date() }).where(and(eq(creatorAttributionLinks.organizationId, organization.id), eq(creatorAttributionLinks.creatorId, creator.id)));
              await db.insert(activityEvents).values({ organizationId: organization.id, creatorId: creator.id, type: "attribution.link_delivered", summary: "Dub attribution link posted to the creator's Discord channel.", metadata: { shortLink: snapshot.shortLink, channelId: connection.privateChannelId } });
            }).catch(async (error) => {
              await db.insert(activityEvents).values({ organizationId: organization.id, creatorId: creator.id, type: "attribution.link_delivery_failed", summary: "Dub link was created but could not be posted to Discord.", metadata: { error: error instanceof Error ? error.message : String(error) } });
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${creator.displayName}: ${message}`);
          const existing = linkByCreator.get(creator.id);
          if (existing) await db.update(creatorAttributionLinks).set({ state: "sync_issue", lastErrorAt: new Date(), lastError: message, updatedAt: new Date() }).where(eq(creatorAttributionLinks.id, existing.id));
        }
      }
      const state = errors.length === seen && seen > 0 ? "failed" : "succeeded";
      if (run) await db.update(syncRuns).set({ state, finishedAt: new Date(), recordsSeen: seen, recordsChanged: changed, error: errors.length ? errors.join(" | ").slice(0, 4000) : null }).where(eq(syncRuns.id, run.id));
    } catch (error) {
      if (run) await db.update(syncRuns).set({ state: "failed", finishedAt: new Date(), recordsSeen: seen, recordsChanged: changed, error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run.id));
      throw error;
    }
  }
}

export function startDubAttributionSchedule(client: Client, onError: (error: unknown) => void): void {
  void syncDubAttribution(client).catch(onError);
  setInterval(() => void syncDubAttribution(client).catch(onError), SYNC_INTERVAL_MS).unref();
}
