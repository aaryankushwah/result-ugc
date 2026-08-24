import {
  ChannelType,
  OverwriteType,
  PermissionFlagsBits,
  type Client,
  type Guild,
  type GuildMember,
  type TextChannel,
} from "discord.js";
import {
  activityEvents,
  creatorDiscord,
  creators,
  discordOperations,
  getDatabase,
  organizations,
  syncRuns,
} from "@result/db";
import { and, asc, eq, lte } from "drizzle-orm";
import { getGuildState } from "../data/store.js";
import { createCreatorChannel, findCreatorChannel } from "./setup.js";

const CREATOR_ROLE = "Verified Creator";
const MEMBER_ROLE = "Member";
const APPLICANT_ROLE = "Applicant";

async function organizationId(guild: Guild): Promise<string> {
  const db = getDatabase();
  const found = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "result")).limit(1);
  if (found[0]) {
    await db.update(organizations).set({ discordGuildId: guild.id, updatedAt: new Date() }).where(eq(organizations.id, found[0].id));
    return found[0].id;
  }
  const [created] = await db.insert(organizations).values({ slug: "result", name: "Result", discordGuildId: guild.id }).returning({ id: organizations.id });
  if (!created) throw new Error("Could not initialize Result organization");
  return created.id;
}

function channelOwnerId(channel: TextChannel): string | null {
  return channel.topic?.match(/Creator ID:\s*(\d+)/)?.[1] ?? null;
}

export async function reconcileGuild(guild: Guild): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const orgId = await organizationId(guild);
  const [members] = await Promise.all([guild.members.fetch(), guild.roles.fetch(), guild.channels.fetch()]);
  const creatorRole = guild.roles.cache.find((role) => role.name === CREATOR_ROLE);
  const applicantRole = guild.roles.cache.find((role) => role.name === APPLICANT_ROLE);
  const legacy = await getGuildState(guild.id);
  const channelByUser = new Map<string, TextChannel>();
  for (const channel of guild.channels.cache.values()) {
    if (channel.type !== ChannelType.GuildText) continue;
    const userId = channelOwnerId(channel);
    if (userId) channelByUser.set(userId, channel);
  }
  const userIds = new Set<string>([
    ...legacy.creatorIds,
    ...channelByUser.keys(),
    ...members.filter((member) => Boolean(creatorRole && member.roles.cache.has(creatorRole.id))).keys(),
    ...members.filter((member) => Boolean(applicantRole && member.roles.cache.has(applicantRole.id))).keys(),
  ]);
  const run = await getDatabase().insert(syncRuns).values({ organizationId: orgId, source: "discord", state: "running", recordsSeen: userIds.size }).returning({ id: syncRuns.id });
  let changed = 0;
  try {
    for (const userId of userIds) {
      const member = members.get(userId);
      const channel = channelByUser.get(userId);
      const hasCreatorRole = Boolean(member && creatorRole && member.roles.cache.has(creatorRole.id));
      const hasApplicantRole = Boolean(member && applicantRole && member.roles.cache.has(applicantRole.id));
      const state = !member ? "left" : hasCreatorRole ? "connected" : hasApplicantRole ? "applicant" : channel ? "missing_access" : "unknown";
      const existing = await getDatabase().select({ creatorId: creatorDiscord.creatorId, state: creatorDiscord.state, channelId: creatorDiscord.privateChannelId }).from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, orgId), eq(creatorDiscord.guildId, guild.id), eq(creatorDiscord.discordUserId, userId))).limit(1);
      const current = existing[0];
      let creatorId = current?.creatorId;
      if (!creatorId) {
        const [created] = await getDatabase().insert(creators).values({ organizationId: orgId, displayName: member?.displayName ?? member?.user.username ?? `Discord ${userId}`, lifecycle: hasCreatorRole || channel ? "active" : "request", lastActivityAt: new Date() }).returning({ id: creators.id });
        if (!created) continue;
        creatorId = created.id;
        await getDatabase().insert(creatorDiscord).values({ organizationId: orgId, creatorId, guildId: guild.id, discordUserId: userId, username: member?.user.username ?? null, displayName: member?.displayName ?? null, avatarUrl: member?.displayAvatarURL({ size: 128 }) ?? null, state, roleIds: member ? [...member.roles.cache.keys()] : [], privateChannelId: channel?.id ?? null, lastReconciledAt: new Date() });
        await logEvent(orgId, creatorId, "discord.creator_discovered", `Discord creator ${member?.displayName ?? userId} was reconciled into Result.`, { state, channelId: channel?.id ?? null });
        changed += 1;
      } else {
        if (!current) continue;
        const didChange = current.state !== state || current.channelId !== (channel?.id ?? null);
        await getDatabase().update(creatorDiscord).set({ username: member?.user.username ?? null, displayName: member?.displayName ?? null, avatarUrl: member?.displayAvatarURL({ size: 128 }) ?? null, state, roleIds: member ? [...member.roles.cache.keys()] : [], privateChannelId: channel?.id ?? null, lastReconciledAt: new Date(), updatedAt: new Date() }).where(eq(creatorDiscord.creatorId, creatorId));
        if (didChange) {
          await logEvent(orgId, creatorId, "discord.state_changed", `Discord access changed to ${state}.`, { previousState: current.state, state, channelId: channel?.id ?? null });
          changed += 1;
        }
      }
    }
    if (run[0]) await getDatabase().update(syncRuns).set({ state: "succeeded", finishedAt: new Date(), recordsChanged: changed }).where(eq(syncRuns.id, run[0].id));
  } catch (error) {
    if (run[0]) await getDatabase().update(syncRuns).set({ state: "failed", finishedAt: new Date(), recordsChanged: changed, error: error instanceof Error ? error.message : String(error) }).where(eq(syncRuns.id, run[0].id));
    throw error;
  }
}

export async function reconcileMember(member: GuildMember): Promise<void> {
  await reconcileGuild(member.guild);
}

async function logEvent(orgId: string, creatorId: string | null, type: string, summary: string, metadata: Record<string, unknown> = {}): Promise<void> {
  await getDatabase().insert(activityEvents).values({ organizationId: orgId, creatorId, type, summary, metadata });
}

export async function processDiscordOperationQueue(client: Client): Promise<void> {
  if (!process.env.DATABASE_URL) return;
  const [operation] = await getDatabase().select().from(discordOperations).where(and(eq(discordOperations.state, "queued"), lte(discordOperations.availableAt, new Date()))).orderBy(asc(discordOperations.createdAt)).limit(1);
  if (!operation) return;
  const claimed = await getDatabase().update(discordOperations).set({ state: "running", lockedAt: new Date(), attempts: operation.attempts + 1, updatedAt: new Date() }).where(and(eq(discordOperations.id, operation.id), eq(discordOperations.state, "queued"))).returning({ id: discordOperations.id });
  if (!claimed.length) return;
  try {
    const guild = await client.guilds.fetch(operation.guildId);
    const connection = operation.creatorId ? (await getDatabase().select().from(creatorDiscord).where(eq(creatorDiscord.creatorId, operation.creatorId)).limit(1))[0] : null;
    const userId = connection?.discordUserId ?? (typeof operation.payload.discordUserId === "string" ? operation.payload.discordUserId : null);
    if (!userId) throw new Error("Discord operation has no mapped user");
    const member = await guild.members.fetch(userId).catch(() => null);
    const creatorRole = guild.roles.cache.find((role) => role.name === CREATOR_ROLE);
    const memberRole = guild.roles.cache.find((role) => role.name === MEMBER_ROLE);
    const applicantRole = guild.roles.cache.find((role) => role.name === APPLICANT_ROLE);
    let channelId = connection?.privateChannelId ?? null;
    if (["approve_applicant", "restore_access", "open_private_channel"].includes(operation.type)) {
      if (!member) throw new Error("Discord member is not in the guild");
      if (operation.type !== "open_private_channel") {
        if (creatorRole) await member.roles.add(creatorRole, `Result operation ${operation.id}`);
        if (memberRole) await member.roles.add(memberRole, `Result operation ${operation.id}`);
        if (applicantRole) await member.roles.remove(applicantRole, `Result operation ${operation.id}`);
      }
      channelId = (await createCreatorChannel(guild, member)).id;
    } else if (operation.type === "reject_applicant") {
      if (member && applicantRole) await member.roles.remove(applicantRole, `Result operation ${operation.id}`);
    } else if (operation.type === "offboard_creator") {
      if (member) {
        if (creatorRole) await member.roles.remove(creatorRole, `Result operation ${operation.id}`);
        if (memberRole) await member.roles.remove(memberRole, `Result operation ${operation.id}`);
      }
      const channel = findCreatorChannel(guild, userId);
      if (channel) { await archiveCreatorChannel(guild, channel); channelId = channel.id; }
      if (member) await member.kick(typeof operation.payload.reason === "string" ? operation.payload.reason : "Offboarded in Result");
      if (operation.creatorId) await getDatabase().update(creators).set({ lifecycle: "offboarded", offboardReason: typeof operation.payload.reason === "string" ? operation.payload.reason : null, offboardedAt: new Date(), updatedAt: new Date() }).where(eq(creators.id, operation.creatorId));
    } else if (operation.type === "reconcile_creator") {
      await reconcileGuild(guild);
    } else throw new Error(`Unsupported operation type: ${operation.type}`);
    await getDatabase().update(discordOperations).set({ state: "succeeded", finishedAt: new Date(), result: { channelId, discordUserId: userId }, lastError: null, updatedAt: new Date() }).where(eq(discordOperations.id, operation.id));
    await logEvent(operation.organizationId, operation.creatorId, `discord.operation.${operation.type}.succeeded`, `Discord operation ${operation.type.replaceAll("_", " ")} succeeded.`, { operationId: operation.id, channelId });
    await reconcileGuild(guild);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retry = operation.attempts + 1 < 3;
    await getDatabase().update(discordOperations).set({ state: retry ? "queued" : "failed", availableAt: retry ? new Date(Date.now() + (operation.attempts + 1) * 30_000) : operation.availableAt, lockedAt: null, lastError: message, updatedAt: new Date() }).where(eq(discordOperations.id, operation.id));
    await logEvent(operation.organizationId, operation.creatorId, `discord.operation.${operation.type}.${retry ? "retrying" : "failed"}`, `Discord operation ${operation.type.replaceAll("_", " ")} ${retry ? "will retry" : "failed"}.`, { operationId: operation.id, error: message });
  }
}

export async function archiveCreatorChannel(guild: Guild, channel: TextChannel): Promise<void> {
  let parent = guild.channels.cache.find((candidate) => candidate.type === ChannelType.GuildCategory && candidate.name === "CREATOR ARCHIVE");
  if (!parent) parent = await guild.channels.create({ name: "CREATOR ARCHIVE", type: ChannelType.GuildCategory, reason: "Result creator offboarding archive" });
  const staffRoles = ["Admin", "UGC Manager", "Moderator"].map((name) => guild.roles.cache.find((role) => role.name === name)).filter((role) => Boolean(role));
  const allow = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages];
  await channel.permissionOverwrites.set([
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] },
    ...staffRoles.map((role) => ({ id: role!.id, type: OverwriteType.Role, allow })),
    ...(guild.members.me ? [{ id: guild.members.me.id, type: OverwriteType.Member as const, allow: [...allow, PermissionFlagsBits.ManageChannels] }] : []),
  ], "Result creator offboarding archive");
  await channel.setParent(parent.id, { lockPermissions: false, reason: "Result creator offboarding archive" });
  await channel.setTopic(`${channel.topic ?? "Creator workspace"} Archived by Result; staff-only history preserved.`);
}
