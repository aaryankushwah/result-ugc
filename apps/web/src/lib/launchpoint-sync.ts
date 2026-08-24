import "server-only";

import { getDatabase, organizations, reconcileLaunchpointDataset, syncRuns } from "@result/db";
import { eq } from "drizzle-orm";
import { getLaunchpointDataset } from "./launchpoint";

export async function syncLaunchpointSnapshots(): Promise<{ creators: number; changed: number }> {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  const db = getDatabase();
  let organization = (await db.select().from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (!organization) [organization] = await db.insert(organizations).values({ slug: "result", name: "Result", discordGuildId: process.env.DISCORD_GUILD_ID ?? null }).returning();
  if (!organization) throw new Error("Could not initialize Result organization");
  const [run] = await db.insert(syncRuns).values({ organizationId: organization.id, source: "launchpoint", state: "running" }).returning({ id: syncRuns.id });
  try {
    const dataset = await getLaunchpointDataset();
    const result = await reconcileLaunchpointDataset({ organizationId: organization.id, ...dataset });
    if (run) await db.update(syncRuns).set({ state: "succeeded", finishedAt: new Date(), recordsSeen: result.creatorsSeen, recordsChanged: result.changed }).where(eq(syncRuns.id, run.id));
    return { creators: result.creatorsSeen, changed: result.changed };
  } catch (error) {
    if (run) await db.update(syncRuns).set({ state: "failed", finishedAt: new Date(), error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run.id));
    throw error;
  }
}
