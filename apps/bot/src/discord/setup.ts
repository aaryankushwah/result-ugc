import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Colors,
  EmbedBuilder,
  GuildFeature,
  GuildVerificationLevel,
  PermissionFlagsBits,
  PermissionsBitField,
  OverwriteType,
  type Guild,
  type GuildBasedChannel,
  type GuildChannelCreateOptions,
  type GuildChannel,
  type GuildMember,
  type GuildTextBasedChannel,
  type OverwriteResolvable,
  type Role,
  type TextChannel,
} from "discord.js";
import {
  categories,
  roles,
  type BlueprintChannelType,
  type ChannelBlueprint,
  type RoleKey,
} from "../config/blueprint.js";
import { channelOverwrites, type RoleMap } from "./permissions.js";
import { discordChannelNameMatches } from "./channel-names.js";

export interface SetupResult {
  rolesCreated: string[];
  rolesReused: string[];
  categoriesCreated: string[];
  categoriesReused: string[];
  channelsCreated: string[];
  channelsReused: string[];
  fallbacks: string[];
}

const auditReason = "UGC server configuration";

function emptyResult(): SetupResult {
  return {
    rolesCreated: [],
    rolesReused: [],
    categoriesCreated: [],
    categoriesReused: [],
    channelsCreated: [],
    channelsReused: [],
    fallbacks: [],
  };
}

function resolveChannelType(
  requested: BlueprintChannelType,
  communityEnabled: boolean,
): { type: ChannelType; fallback?: string } {
  if (requested === "announcement") {
    return communityEnabled
      ? { type: ChannelType.GuildAnnouncement }
      : { type: ChannelType.GuildText, fallback: "announcement → text (enable Community first)" };
  }
  if (requested === "forum") {
    return communityEnabled
      ? { type: ChannelType.GuildForum }
      : { type: ChannelType.GuildText, fallback: "forum → text (enable Community first)" };
  }
  if (requested === "stage") {
    return communityEnabled
      ? { type: ChannelType.GuildStageVoice }
      : { type: ChannelType.GuildVoice, fallback: "stage → voice (enable Community first)" };
  }
  if (requested === "voice") return { type: ChannelType.GuildVoice };
  return { type: ChannelType.GuildText };
}

async function ensureRoles(guild: Guild, result: SetupResult): Promise<RoleMap> {
  await guild.roles.fetch();
  const roleMap: RoleMap = new Map();

  // Discord inserts each newly-created role above the previous one. Creating from
  // highest to lowest leaves Admin at the top of this bot-managed role group.
  for (const blueprint of roles) {
    let role = guild.roles.cache.find((candidate) => candidate.name === blueprint.name);
    if (!role) {
      role = await guild.roles.create({
        name: blueprint.name,
        colors: { primaryColor: blueprint.color },
        hoist: blueprint.hoist ?? false,
        mentionable: blueprint.mentionable ?? false,
        permissions: blueprint.permissions,
        reason: auditReason,
      });
      result.rolesCreated.push(blueprint.name);
    } else {
      const expectedPermissions = PermissionsBitField.resolve(blueprint.permissions);
      if (role.permissions.bitfield !== expectedPermissions) {
        await role.setPermissions(blueprint.permissions, auditReason);
      }
      result.rolesReused.push(blueprint.name);
    }
    roleMap.set(blueprint.key, role);
  }

  return roleMap;
}

function channelMatches(candidate: GuildBasedChannel, name: string, parentId: string): boolean {
  return discordChannelNameMatches(candidate.name, name) && candidate.parentId === parentId;
}

async function ensureChannel(
  guild: Guild,
  parentId: string,
  blueprint: ChannelBlueprint,
  roleMap: RoleMap,
  communityEnabled: boolean,
  result: SetupResult,
): Promise<GuildBasedChannel> {
  const resolved = resolveChannelType(blueprint.type, communityEnabled);
  if (resolved.fallback) result.fallbacks.push(`${blueprint.name}: ${resolved.fallback}`);
  const topic = blueprint.topic;
  const overwrites = channelOverwrites(guild, roleMap, blueprint.access, blueprint.readOnly ?? false);
  const existing = guild.channels.cache.find(
    (candidate) => !candidate.isThread() && channelMatches(candidate, blueprint.name, parentId),
  ) as GuildChannel | undefined;
  if (existing) {
    await existing.permissionOverwrites.set(overwrites, auditReason);
    if (
      existing.type === ChannelType.GuildText ||
      existing.type === ChannelType.GuildAnnouncement ||
      existing.type === ChannelType.GuildForum
    ) {
      await existing.edit({ topic: topic ?? null, reason: auditReason });
    }
    result.channelsReused.push(blueprint.name);
    return existing as GuildBasedChannel;
  }
  const common = {
    name: blueprint.name,
    type: resolved.type,
    parent: parentId,
    permissionOverwrites: overwrites,
    reason: auditReason,
  };

  const options: GuildChannelCreateOptions = {
    ...common,
    ...([ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum].includes(resolved.type)
      ? { topic }
      : {}),
    ...(resolved.type === ChannelType.GuildText && blueprint.slowmode
      ? { rateLimitPerUser: blueprint.slowmode }
      : {}),
    ...(resolved.type === ChannelType.GuildForum && blueprint.tags
      ? { availableTags: blueprint.tags.slice(0, 20).map((name) => ({ name, moderated: false })) }
      : {}),
  } as GuildChannelCreateOptions;

  const created = await guild.channels.create(options);
  result.channelsCreated.push(blueprint.name);
  return created;
}

async function ensureVerificationPanel(channel: GuildTextBasedChannel): Promise<void> {
  const recent = await channel.messages.fetch({ limit: 50 });
  const existing = recent.find(
    (message) =>
      message.author.id === channel.client.user.id &&
      message.embeds.some(
        (embed) => embed.title === "Verify access" || embed.footer?.text === "ugc-setup:verify",
      ),
  );
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Verify access")
    .setDescription(
      [
        "Complete Discord's server rules, then click **Verify**.",
        "",
        "Requirements:",
        "• Account is at least 7 days old",
        "• Discord Rules Screening is complete",
        "",
        "Verification creates an approval request in #onboarding-alerts. UGC channels stay hidden until staff approve creator access.",
      ].join("\n"),
    );
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("verify:member").setLabel("Verify").setStyle(ButtonStyle.Success),
  );
  const payload = { embeds: [embed], components: [row] };
  if (existing) await existing.edit(payload);
  else await channel.send(payload);
}

async function seedChannels(channelsByKey: Map<string, GuildBasedChannel>): Promise<void> {
  const verify = channelsByKey.get("verify");
  if (verify?.isTextBased()) await ensureVerificationPanel(verify);
}

function creatorChannelName(member: GuildMember): string {
  const normalized = member.displayName
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `creator-${member.id.slice(-6)}`;
}

export function findCreatorChannel(guild: Guild, userId: string): TextChannel | undefined {
  const markerText = `Creator ID: ${userId}`;
  const channel = guild.channels.cache.find(
    (candidate) => candidate.type === ChannelType.GuildText && candidate.topic?.includes(markerText),
  );
  return channel?.type === ChannelType.GuildText ? channel : undefined;
}

export async function createCreatorChannel(guild: Guild, member: GuildMember): Promise<TextChannel> {
  await guild.channels.fetch();
  await guild.roles.fetch();
  const existing = findCreatorChannel(guild, member.id);
  if (existing) {
    await existing.edit({
      topic: `Private workspace for ${member.user.tag}. Creator ID: ${member.id}.`,
      reason: auditReason,
    });
    await ensureCreatorWelcome(existing);
    return existing;
  }

  let parent = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === "CREATORS",
  );
  if (!parent) {
    parent = await guild.channels.create({ name: "CREATORS", type: ChannelType.GuildCategory, reason: auditReason });
  }

  const manager = guild.roles.cache.find((role) => role.name === "UGC Manager");
  const admin = guild.roles.cache.find((role) => role.name === "Admin");
  const moderator = guild.roles.cache.find((role) => role.name === "Moderator");
  const botId = guild.members.me?.id;
  const permissions = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AddReactions,
  ];
  const overwrites = new Map<string, OverwriteResolvable>();
  overwrites.set(guild.roles.everyone.id, {
    id: guild.roles.everyone.id,
    type: OverwriteType.Role,
    deny: [PermissionFlagsBits.ViewChannel],
  });
  overwrites.set(member.id, { id: member.id, type: OverwriteType.Member, allow: permissions });
  overwrites.set(guild.ownerId, { id: guild.ownerId, type: OverwriteType.Member, allow: permissions });
  if (manager) overwrites.set(manager.id, { id: manager.id, type: OverwriteType.Role, allow: permissions });
  if (admin) overwrites.set(admin.id, { id: admin.id, type: OverwriteType.Role, allow: permissions });
  if (moderator) overwrites.set(moderator.id, { id: moderator.id, type: OverwriteType.Role, allow: permissions });
  if (botId) {
    overwrites.set(botId, {
      id: botId,
      type: OverwriteType.Member,
      allow: [...permissions, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages],
    });
  }

  const baseName = creatorChannelName(member);
  const nameTaken = guild.channels.cache.some(
    (channel) => channel.parentId === parent.id && channel.name === baseName,
  );
  const channel = await guild.channels.create({
    name: nameTaken ? `${baseName}-${member.id.slice(-4)}` : baseName,
    type: ChannelType.GuildText,
    parent: parent.id,
    topic: `Private workspace for ${member.user.tag}. Creator ID: ${member.id}.`,
    permissionOverwrites: [...overwrites.values()],
    reason: auditReason,
  });
  await ensureCreatorWelcome(channel);
  return channel;
}

async function ensureCreatorWelcome(channel: TextChannel): Promise<void> {
  const recent = await channel.messages.fetch({ limit: 50 });
  const alreadyPosted = recent.some((message) =>
    message.author.id === channel.client.user.id && message.embeds.some((embed) => embed.title === "Welcome to the Result Creator Program"),
  );
  if (alreadyPosted) return;
  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle("Welcome to the Result Creator Program")
    .setDescription(
      [
        `Welcome, ${channel.name}! Your creator access is approved.`,
        "",
        "Start here:",
        "1. Read the server **#rules**.",
        "2. Review **#resources** for creator guidance and templates.",
        "3. Check **#announcements** for active briefs and updates.",
        "4. Use `/submit` in this private channel when your work is ready for review.",
        "",
        "If anything is unclear, ask the UGC Manager in this channel.",
      ].join("\n"),
    );
  await channel.send({ embeds: [embed] });
}

export async function setupGuild(guild: Guild): Promise<SetupResult> {
  const result = emptyResult();
  await guild.channels.fetch();
  const roleMap = await ensureRoles(guild, result);
  if (guild.verificationLevel > GuildVerificationLevel.Medium) {
    await guild.setVerificationLevel(GuildVerificationLevel.Medium, auditReason);
  }
  const communityEnabled = guild.features.includes(GuildFeature.Community);
  const channelsByKey = new Map<string, GuildBasedChannel>();

  for (const category of categories) {
    let parent = guild.channels.cache.find(
      (channel) => channel.type === ChannelType.GuildCategory && channel.name === category.name,
    );
    if (!parent) {
      parent = await guild.channels.create({ name: category.name, type: ChannelType.GuildCategory, reason: auditReason });
      result.categoriesCreated.push(category.name);
    } else {
      result.categoriesReused.push(category.name);
    }

    for (const channelBlueprint of category.channels) {
      const channel = await ensureChannel(
        guild,
        parent.id,
        channelBlueprint,
        roleMap,
        communityEnabled,
        result,
      );
      channelsByKey.set(channelBlueprint.key, channel);
    }
  }

  await seedChannels(channelsByKey);
  const creatorCategory = guild.channels.cache.find(
    (channel) => channel.type === ChannelType.GuildCategory && channel.name === "CREATORS",
  );
  if (creatorCategory) {
    const creatorChannels = guild.channels.cache.filter(
      (channel): channel is TextChannel => channel.parentId === creatorCategory.id && channel.type === ChannelType.GuildText,
    );
    for (const creatorChannel of creatorChannels.values()) await ensureCreatorWelcome(creatorChannel);
  }
  return result;
}

export function setupSummary(result: SetupResult): string {
  const lines = [
    `Created **${result.rolesCreated.length}** roles, **${result.categoriesCreated.length}** categories, and **${result.channelsCreated.length}** channels.`,
  ];
  if (result.rolesReused.length || result.categoriesReused.length || result.channelsReused.length) {
    lines.push(
      `Reused **${result.rolesReused.length}** roles, **${result.categoriesReused.length}** categories, and **${result.channelsReused.length}** channels, so rerunning setup did not duplicate them.`,
    );
  }
  if (result.fallbacks.length) {
    lines.push(
      `**Community mode is not enabled.** ${result.fallbacks.length} forum/announcement/stage channels were created as compatible text/voice fallbacks. Enable Community before setup on a fresh server to get native channel types.`,
    );
  }
  lines.push(
    "Assign the Admin, UGC Manager, and Moderator roles only to trusted people. Use **/add-creator @member** to make a private creator workspace.",
  );
  return lines.join("\n");
}
