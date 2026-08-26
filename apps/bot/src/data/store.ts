import { chmod, copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getDatabase, legacyGuildStates, organizations } from "@result/db";
import { and, eq } from "drizzle-orm";

type SubmissionStatus = "pending" | "approved" | "revision" | "rejected" | "posted";

interface SubmissionRecord {
  id: string;
  creatorId: string;
  campaign: string;
  assetUrl: string;
  notes: string;
  status: SubmissionStatus;
  publishedUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface CreatorLinkRecord {
  id: string;
  creatorId: string;
  creatorName: string;
  campaign: string;
  destinationUrl: string;
  shortLink: string;
  createdAt: string;
}

export interface CallPollRecord {
  id: string;
  channelId: string;
  messageId?: string;
  createdBy: string;
  weekStart: string;
  baseTimezone: "est" | "pst" | "ist";
  durationMinutes: number;
  slots: Array<{ id: string; startsAt: string }>;
  responses: Record<string, { timezone: "est" | "pst" | "ist"; slotIds: string[] }>;
}

interface CreatorReviewRecord {
  creatorId: string;
  launchpointCreatorId?: string;
  notes: string[];
  nextSteps: string;
  status?: "active" | "inactive" | "watch";
  updatedAt: string;
}

export interface GuildState {
  programName: string;
  quota: number;
  trialDays: number;
  remindersEnabled: boolean;
  creatorIds: string[];
  submissions: SubmissionRecord[];
  creatorLinks: CreatorLinkRecord[];
  callPolls: CallPollRecord[];
  launchpointSeenPostIds: string[];
  creatorReviews: CreatorReviewRecord[];
  lastMetricsRefresh?: string;
  lastReminderDate?: string;
  lastCreatorFollowupDate?: string;
}

interface StoreFile {
  guilds: Record<string, GuildState>;
}

const dataDir = path.resolve(process.cwd(), ".data");
const dataFile = path.join(dataDir, "state.json");
let writeQueue: Promise<void> = Promise.resolve();
let migrationChecked = false;

function defaultGuildState(): GuildState {
  return {
    programName: "UGC Program",
    quota: 3,
    trialDays: 0,
    remindersEnabled: false,
    creatorIds: [],
    submissions: [],
    creatorLinks: [],
    callPolls: [],
    launchpointSeenPostIds: [],
    creatorReviews: [],
  };
}

async function readStore(): Promise<StoreFile> {
  try {
    return JSON.parse(await readFile(dataFile, "utf8")) as StoreFile;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { guilds: {} };
    throw error;
  }
}

async function writeStore(store: StoreFile): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const temporary = `${dataFile}.tmp`;
  await writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, dataFile);
}

async function resultOrganizationId(): Promise<string> {
  const db = getDatabase();
  const existing = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "result")).limit(1);
  if (existing[0]) return existing[0].id;
  const created = await db.insert(organizations).values({ slug: "result", name: "Result", discordGuildId: process.env.DISCORD_GUILD_ID?.trim() || null }).onConflictDoNothing({ target: organizations.slug }).returning({ id: organizations.id });
  if (created[0]) return created[0].id;
  const raced = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "result")).limit(1);
  if (!raced[0]) throw new Error("Could not create Result organization");
  return raced[0].id;
}

async function migrateLegacyFileOnce(): Promise<void> {
  if (migrationChecked || !process.env.DATABASE_URL) return;
  migrationChecked = true;
  let legacy: StoreFile;
  try { legacy = await readStore(); } catch (error) { console.error("Legacy state migration read failed", error); return; }
  if (!Object.keys(legacy.guilds).length) return;
  const organizationId = await resultOrganizationId();
  const existing = await getDatabase().select({ guildId: legacyGuildStates.guildId }).from(legacyGuildStates).where(eq(legacyGuildStates.organizationId, organizationId)).limit(1);
  if (existing.length) return;
  await mkdir(path.join(dataDir, "backups"), { recursive: true });
  const backupPath = path.join(dataDir, "backups", `state-${new Date().toISOString().replaceAll(":", "-")}.json`);
  await copyFile(dataFile, backupPath);
  await chmod(backupPath, 0o400);
  await getDatabase().insert(legacyGuildStates).values(Object.entries(legacy.guilds).map(([guildId, state]) => ({ guildId, organizationId, state: state as unknown as Record<string, unknown> }))).onConflictDoNothing();
  console.log(`Migrated legacy bot state to Postgres. Immutable backup: ${backupPath}`);
}

async function getDatabaseGuildState(guildId: string): Promise<GuildState> {
  await migrateLegacyFileOnce();
  const organizationId = await resultOrganizationId();
  const row = await getDatabase().select({ state: legacyGuildStates.state }).from(legacyGuildStates).where(and(eq(legacyGuildStates.guildId, guildId), eq(legacyGuildStates.organizationId, organizationId))).limit(1);
  return structuredClone({ ...defaultGuildState(), ...((row[0]?.state ?? {}) as Partial<GuildState>) });
}

export async function getGuildState(guildId: string): Promise<GuildState> {
  await writeQueue;
  if (process.env.DATABASE_URL) return getDatabaseGuildState(guildId);
  const store = await readStore();
  return structuredClone({ ...defaultGuildState(), ...(store.guilds[guildId] ?? {}) });
}

export async function updateGuildState(
  guildId: string,
  update: (state: GuildState) => void | Promise<void>,
): Promise<GuildState> {
  let result = defaultGuildState();
  writeQueue = writeQueue.then(async () => {
    if (process.env.DATABASE_URL) {
      const organizationId = await resultOrganizationId();
      const state = await getDatabaseGuildState(guildId);
      await update(state);
      await getDatabase().insert(legacyGuildStates).values({ guildId, organizationId, state: state as unknown as Record<string, unknown>, updatedAt: new Date() }).onConflictDoUpdate({ target: [legacyGuildStates.guildId, legacyGuildStates.organizationId], set: { state: state as unknown as Record<string, unknown>, updatedAt: new Date() } });
      result = structuredClone(state);
      return;
    }
    const store = await readStore();
    const state = structuredClone({ ...defaultGuildState(), ...(store.guilds[guildId] ?? {}) });
    await update(state);
    store.guilds[guildId] = state;
    await writeStore(store);
    result = structuredClone(state);
  });
  await writeQueue;
  return result;
}
