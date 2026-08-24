import { chmod, copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { activityEvents, closeDatabase, creatorDiscord, creators, getDatabase, organizations, syncRuns } from "@result/db";
import { and, eq } from "drizzle-orm";
import { suggestExactAccountLinks } from "../src/discord/platform-sync.js";

type LegacyStore = { guilds?: Record<string, { creatorIds?: string[] }> };
type DiscordRole = { id: string; name: string };
type DiscordChannel = { id: string; type: number; topic?: string | null };
type DiscordMember = { user: { id: string; username: string; global_name?: string | null; avatar?: string | null }; nick?: string | null; roles: string[] };

async function discordGet<T>(pathName: string): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${pathName}`, { headers: { authorization: `Bot ${process.env.DISCORD_TOKEN}` } });
  if (!response.ok) throw new Error(`Discord ${pathName} failed (${response.status}): ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function legacySeeds(): Promise<Map<string, string[]>> {
  const file = process.env.LEGACY_STATE_FILE?.trim();
  if (!file) return new Map();
  const resolved = path.resolve(file);
  const raw = await readFile(resolved, "utf8");
  const parsed = JSON.parse(raw) as LegacyStore;
  const backupDir = path.join(path.dirname(resolved), "backups");
  await mkdir(backupDir, { recursive: true });
  const backup = path.join(backupDir, `state-before-result-${new Date().toISOString().replaceAll(":", "-")}.json`);
  await copyFile(resolved, backup);
  await chmod(backup, 0o400);
  console.log(`Preserved immutable legacy-state backup at ${backup}`);
  return new Map(Object.entries(parsed.guilds ?? {}).map(([guildId, state]) => [guildId, state.creatorIds ?? []]));
}

async function organizationId(guildId: string): Promise<string> {
  const existing = (await getDatabase().select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (existing) { await getDatabase().update(organizations).set({ discordGuildId: guildId, updatedAt: new Date() }).where(eq(organizations.id, existing.id)); return existing.id; }
  const [created] = await getDatabase().insert(organizations).values({ slug: "result", name: "Result", discordGuildId: guildId }).returning({ id: organizations.id });
  if (!created) throw new Error("Could not initialize Result organization");
  return created.id;
}

async function reconcileKnownGuild(guildId: string, seedIds: string[]): Promise<void> {
  const orgId = await organizationId(guildId);
  const [roles, channels] = await Promise.all([
    discordGet<DiscordRole[]>(`/guilds/${guildId}/roles`),
    discordGet<DiscordChannel[]>(`/guilds/${guildId}/channels`),
  ]);
  const creatorRole = roles.find((role) => role.name === "Verified Creator");
  const applicantRole = roles.find((role) => role.name === "Applicant");
  const channelByUser = new Map<string, string>();
  for (const channel of channels) {
    const userId = channel.topic?.match(/Creator ID:\s*(\d+)/)?.[1];
    if (userId) channelByUser.set(userId, channel.id);
  }
  const userIds = new Set([...seedIds, ...channelByUser.keys()]);
  const [run] = await getDatabase().insert(syncRuns).values({ organizationId: orgId, source: "discord", state: "running", recordsSeen: userIds.size }).returning({ id: syncRuns.id });
  let changed = 0;
  try {
    for (const userId of userIds) {
      const member = await discordGet<DiscordMember>(`/guilds/${guildId}/members/${userId}`).catch(() => null);
      const hasCreatorRole = Boolean(member && creatorRole && member.roles.includes(creatorRole.id));
      const hasApplicantRole = Boolean(member && applicantRole && member.roles.includes(applicantRole.id));
      const channelId = channelByUser.get(userId) ?? null;
      const state = !member ? "left" : hasCreatorRole ? "connected" : hasApplicantRole ? "applicant" : channelId ? "missing_access" : "unknown";
      const existing = (await getDatabase().select({ creatorId: creatorDiscord.creatorId, state: creatorDiscord.state, channelId: creatorDiscord.privateChannelId }).from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, orgId), eq(creatorDiscord.guildId, guildId), eq(creatorDiscord.discordUserId, userId))).limit(1))[0];
      const displayName = member?.nick ?? member?.user.global_name ?? member?.user.username ?? `Discord ${userId}`;
      const avatarUrl = member?.user.avatar ? `https://cdn.discordapp.com/avatars/${userId}/${member.user.avatar}.png?size=128` : null;
      if (!existing) {
        const [creator] = await getDatabase().insert(creators).values({ organizationId: orgId, displayName, lifecycle: hasCreatorRole || channelId ? "active" : "request", attentionState: hasCreatorRole ? null : "Discord access needs review", nextStep: hasCreatorRole ? "Confirm social accounts and Launchpoint signing" : "Review Discord access", lastActivityAt: new Date() }).returning({ id: creators.id });
        if (!creator) continue;
        await getDatabase().insert(creatorDiscord).values({ organizationId: orgId, creatorId: creator.id, guildId, discordUserId: userId, username: member?.user.username ?? null, displayName, avatarUrl, state, roleIds: member?.roles ?? [], privateChannelId: channelId, lastReconciledAt: new Date() });
        await getDatabase().insert(activityEvents).values({ organizationId: orgId, creatorId: creator.id, type: "discord.creator_discovered", summary: `Discord creator ${displayName} was reconciled into Result.`, metadata: { state, channelId, reconciliation: "targeted_rest" } });
        changed += 1;
      } else {
        const didChange = existing.state !== state || existing.channelId !== channelId;
        await getDatabase().update(creatorDiscord).set({ username: member?.user.username ?? null, displayName, avatarUrl, state, roleIds: member?.roles ?? [], privateChannelId: channelId, lastReconciledAt: new Date(), updatedAt: new Date() }).where(eq(creatorDiscord.creatorId, existing.creatorId));
        await getDatabase().update(creators).set({ displayName, lastActivityAt: new Date(), updatedAt: new Date() }).where(eq(creators.id, existing.creatorId));
        if (didChange) { await getDatabase().insert(activityEvents).values({ organizationId: orgId, creatorId: existing.creatorId, type: "discord.state_changed", summary: `Discord access changed to ${state}.`, metadata: { previousState: existing.state, state, channelId } }); changed += 1; }
      }
    }
    changed += await suggestExactAccountLinks(orgId);
    if (run) await getDatabase().update(syncRuns).set({ state: "succeeded", finishedAt: new Date(), recordsChanged: changed }).where(eq(syncRuns.id, run.id));
    console.log(`Reconciled ${userIds.size} known creators from guild ${guildId}; ${changed} records changed.`);
  } catch (error) {
    if (run) await getDatabase().update(syncRuns).set({ state: "failed", finishedAt: new Date(), recordsChanged: changed, error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run.id));
    throw error;
  }
}

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!process.env.DISCORD_TOKEN) throw new Error("DISCORD_TOKEN is required");
const seeds = await legacySeeds();
const configuredGuildId = process.env.DISCORD_GUILD_ID?.trim();
const guildIds = new Set<string>([...(configuredGuildId ? [configuredGuildId] : []), ...seeds.keys()]);
if (!guildIds.size) throw new Error("DISCORD_GUILD_ID or a guild in LEGACY_STATE_FILE is required");
try { for (const guildId of guildIds) await reconcileKnownGuild(guildId, seeds.get(guildId) ?? []); }
finally { await closeDatabase(); }
