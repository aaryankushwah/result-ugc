import {
  attributionDailySnapshots,
  creatorAttributionLinks,
  creatorDiscord,
  creators,
  getDatabase,
  organizations,
  syncRuns,
} from "@result/db";
import { and, eq } from "drizzle-orm";
import { getDubLink, type DubLinkSnapshot } from "../integrations/dub.js";

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
  const snapshotValues = {
    providerLinkId: input.snapshot.id,
    externalId: input.snapshot.externalId,
    shortLink: input.snapshot.shortLink,
    destinationUrl: input.snapshot.destinationUrl,
    linkKey: input.snapshot.key ?? null,
    state: "active" as const,
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
  };
  const [saved] = await db.insert(creatorAttributionLinks).values({
    organizationId: input.organizationId,
    creatorId: input.creatorId,
    ...snapshotValues,
  }).onConflictDoUpdate({
    target: [creatorAttributionLinks.organizationId, creatorAttributionLinks.creatorId],
    set: {
      ...snapshotValues,
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

async function syncDubAttribution(): Promise<void> {
  if (!process.env.DATABASE_URL || !process.env.DUB_API_KEY) return;
  const db = getDatabase();
  const organizationRows = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "result"));
  for (const organization of organizationRows) {
    if (!organization) continue;
    const [run] = await db.insert(syncRuns).values({ organizationId: organization.id, source: "dub", state: "running" }).returning({ id: syncRuns.id });
    let seen = 0;
    const errors: string[] = [];
    try {
      const linkRows = await db.select().from(creatorAttributionLinks).where(eq(creatorAttributionLinks.organizationId, organization.id));
      for (const existing of linkRows) {
        seen += 1;
        try {
          const snapshot = await getDubLink(existing.providerLinkId);
          if (!snapshot.destinationUrl) snapshot.destinationUrl = existing.destinationUrl;
          await persistDubLinkSnapshot({ organizationId: organization.id, creatorId: existing.creatorId, snapshot });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`${existing.shortLink}: ${message}`);
          await db.update(creatorAttributionLinks).set({ state: "sync_issue", lastErrorAt: new Date(), lastError: message, updatedAt: new Date() }).where(eq(creatorAttributionLinks.id, existing.id));
        }
      }
      const state = errors.length === seen && seen > 0 ? "failed" : "succeeded";
      if (run) await db.update(syncRuns).set({ state, finishedAt: new Date(), recordsSeen: seen, recordsChanged: 0, error: errors.length ? errors.join(" | ").slice(0, 4000) : null }).where(eq(syncRuns.id, run.id));
    } catch (error) {
      if (run) await db.update(syncRuns).set({ state: "failed", finishedAt: new Date(), recordsSeen: seen, recordsChanged: 0, error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run.id));
      throw error;
    }
  }
}

export function startDubAttributionSchedule(onError: (error: unknown) => void): void {
  void syncDubAttribution().catch(onError);
  setInterval(() => void syncDubAttribution().catch(onError), SYNC_INTERVAL_MS).unref();
}
