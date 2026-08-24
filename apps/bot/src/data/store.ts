import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type SubmissionStatus = "pending" | "approved" | "revision" | "rejected" | "posted";

export interface SubmissionRecord {
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

export interface CreatorLinkRecord {
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

export interface CreatorReviewRecord {
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

export async function getGuildState(guildId: string): Promise<GuildState> {
  await writeQueue;
  const store = await readStore();
  return structuredClone({ ...defaultGuildState(), ...(store.guilds[guildId] ?? {}) });
}

export async function updateGuildState(
  guildId: string,
  update: (state: GuildState) => void | Promise<void>,
): Promise<GuildState> {
  let result = defaultGuildState();
  writeQueue = writeQueue.then(async () => {
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

export async function removeGuildState(guildId: string): Promise<boolean> {
  let removed = false;
  writeQueue = writeQueue.then(async () => {
    const store = await readStore();
    removed = Boolean(store.guilds[guildId]);
    delete store.guilds[guildId];
    await writeStore(store);
  });
  await writeQueue;
  return removed;
}
