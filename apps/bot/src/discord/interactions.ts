import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Colors,
  EmbedBuilder,
  GuildFeature,
  GuildVerificationLevel,
  MessageFlags,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Guild,
  type GuildTextBasedChannel,
  type Interaction,
} from "discord.js";
import { randomUUID } from "node:crypto";
import { blueprintChannels, categories, roles } from "../config/blueprint.js";
import {
  getGuildState,
  removeGuildState,
  updateGuildState,
  type SubmissionStatus,
  type CallPollRecord,
} from "../data/store.js";
import { createCreatorChannel, findCreatorChannel, setupGuild, setupSummary } from "./setup.js";
import { deleteDubLink, issueDubLink } from "../integrations/dub.js";
import { launchpointGet } from "../integrations/launchpoint.js";
import { runReminderSweep } from "./reminders.js";
import { CALL_TIMEZONES, type CallTimezone, currentMondayUtc, dateLabel, formatSlot, generateCallSlots, nextMondayUtc, validDate } from "./calls.js";

const MIN_ACCOUNT_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const VERIFY_COOLDOWN_MS = 15 * 1_000;
const verificationAttempts = new Map<string, number>();
type LaunchpointDirectoryCreator = { id: string; name: string; status?: string; campaigns?: Array<{ contractStatus?: string; programName?: string }> };
type LaunchpointDirectoryPost = { creatorId?: string; contractorName?: string };
let launchpointCreatorCache: { expiresAt: number; creators: LaunchpointDirectoryCreator[] } = { expiresAt: 0, creators: [] };

export async function launchpointCreatorDirectory(): Promise<LaunchpointDirectoryCreator[]> {
  if (launchpointCreatorCache.expiresAt > Date.now()) return launchpointCreatorCache.creators;
  const [creatorResult, postResult] = await Promise.allSettled([
    launchpointGet<{ data?: Array<{ id?: string; name?: string; status?: string; campaigns?: Array<{ contractStatus?: string; programName?: string }> }> }>("/creators", { limit: "500" }),
    launchpointGet<{ data?: LaunchpointDirectoryPost[] }>("/posts", { limit: "500" }),
  ]);
  const byId = new Map<string, LaunchpointDirectoryCreator>();
  if (creatorResult.status === "fulfilled") {
    for (const creator of creatorResult.value.data ?? []) {
      if (creator.id && creator.name) byId.set(creator.id, { id: creator.id, name: creator.name, ...(creator.status ? { status: creator.status } : {}), ...(creator.campaigns ? { campaigns: creator.campaigns } : {}) });
    }
  }
  if (postResult.status === "fulfilled") {
    for (const post of postResult.value.data ?? []) {
      if (post.creatorId && post.contractorName && !byId.has(post.creatorId)) byId.set(post.creatorId, { id: post.creatorId, name: post.contractorName });
    }
  }
  launchpointCreatorCache = { expiresAt: Date.now() + 5 * 60 * 1_000, creators: [...byId.values()] };
  return launchpointCreatorCache.creators;
}

function findTextChannel(guild: Guild, name: string): GuildTextBasedChannel | undefined {
  const channel = guild.channels.cache.find((candidate) => candidate.name === name && candidate.isTextBased());
  return channel?.isTextBased() && !channel.isDMBased() ? channel : undefined;
}

async function logVerification(guild: Guild, userId: string, result: string): Promise<void> {
  const log = findTextChannel(guild, "onboarding-alerts");
  if (!log) return;
  await log.send({
    content: `<@${userId}> — ${result}`,
    allowedMentions: { parse: [] },
  }).catch(() => undefined);
}

function isStaff(interaction: ButtonInteraction): boolean {
  return Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels),
  );
}

async function sendCreatorApprovalRequest(guild: Guild, userId: string, displayName: string): Promise<void> {
  const approvals = findTextChannel(guild, "onboarding-alerts");
  if (!approvals) return;
  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle("Creator approval request")
    .setDescription(`<@${userId}> has completed verification and is requesting creator access.`)
    .addFields(
      { name: "Member", value: `${displayName} (<@${userId}>)` },
      { name: "Access requested", value: "Member + Verified Creator + private creator channel" },
    )
    .setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`creator:approve:${userId}`).setLabel("Approve creator").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`creator:reject:${userId}`).setLabel("Reject").setStyle(ButtonStyle.Danger),
  );
  await approvals.send({
    embeds: [embed],
    components: [row],
    allowedMentions: { users: [userId] },
  });
}

async function sendCreatorManagerHandoff(guild: Guild, member: import("discord.js").GuildMember, channel: import("discord.js").TextChannel): Promise<void> {
  const approvals = findTextChannel(guild, "onboarding-alerts");
  if (!approvals) return;
  const embed = new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle("Creator workspace ready")
    .setDescription(`<@${member.id}> was approved and their private channel is ready: <#${channel.id}>.`)
    .addFields({
      name: "Manager next steps",
      value: [
        "1. Link their Launchpoint profile.",
        "2. Issue their Dub link from the private channel.",
        "3. Use `/creator-review` any time you need their activity summary.",
      ].join("\n"),
    })
    .setTimestamp();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`creator-assign:start:${member.id}`)
      .setLabel("Link Launchpoint creator")
      .setStyle(ButtonStyle.Primary),
  );
  await approvals.send({ embeds: [embed], components: [row], allowedMentions: { users: [member.id] } });
}

async function handleVerify(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.guild) return;
  // Acknowledge immediately: role/channel operations can take longer than
  // Discord's three-second interaction response window.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const now = Date.now();
  const previousAttempt = verificationAttempts.get(interaction.user.id) ?? 0;
  if (now - previousAttempt < VERIFY_COOLDOWN_MS) {
    await interaction.editReply({
      content: "Please wait a few seconds before trying again.",
    });
    return;
  }
  verificationAttempts.set(interaction.user.id, now);

  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => undefined);
  const memberRole = interaction.guild.roles.cache.find((role) => role.name === "Member");
  const applicantRole = interaction.guild.roles.cache.find((role) => role.name === "Applicant");
  if (!member || !memberRole || !applicantRole) {
    await interaction.editReply({
      content: "Verification is not ready. Ask an admin to run `/health`.",
    });
    return;
  }
  if (interaction.user.bot) {
    await logVerification(interaction.guild, interaction.user.id, "verification blocked: bot account");
    await interaction.editReply({ content: "Bot accounts cannot verify." });
    return;
  }
  if (member.roles.cache.has(memberRole.id)) {
    await interaction.editReply({ content: "You are already approved." });
    return;
  }
  if (member.roles.cache.has(applicantRole.id)) {
    await interaction.editReply({ content: "Your creator access request is already waiting for staff approval." });
    return;
  }
  if (member.pending) {
    await logVerification(interaction.guild, interaction.user.id, "verification blocked: Rules Screening incomplete");
    await interaction.editReply({
      content: "Accept Discord's server rules first, then try again.",
    });
    return;
  }
  if (now - interaction.user.createdTimestamp < MIN_ACCOUNT_AGE_MS) {
    await logVerification(interaction.guild, interaction.user.id, "verification blocked: account under 7 days old");
    await interaction.editReply({
      content: "Your Discord account must be at least 7 days old.",
    });
    return;
  }
  await member.roles.add(applicantRole, "Completed verification; awaiting creator approval");
  await sendCreatorApprovalRequest(interaction.guild, interaction.user.id, member.displayName);
  await logVerification(interaction.guild, interaction.user.id, "verified; creator approval requested");
  await interaction.editReply({
    content: "Verification complete. Your creator access request is waiting for staff approval; the UGC channels will unlock after approval.",
  });
}

async function handleCreatorDecision(interaction: ButtonInteraction, action: "approve" | "reject", userId: string): Promise<void> {
  if (!interaction.guild || !isStaff(interaction)) {
    await interaction.reply({ content: "Only the moderation team can approve creator access.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferUpdate();
  const member = await interaction.guild.members.fetch(userId).catch(() => undefined);
  if (!member) {
    await interaction.message.edit({ content: "Member is no longer in the server.", components: [] });
    return;
  }
  const applicantRole = interaction.guild.roles.cache.find((role) => role.name === "Applicant");
  const memberRole = interaction.guild.roles.cache.find((role) => role.name === "Member");
  const creatorRole = interaction.guild.roles.cache.find((role) => role.name === "Verified Creator");
  if (action === "approve") {
    if (memberRole) await member.roles.add(memberRole, "Creator application approved");
    if (creatorRole) await member.roles.add(creatorRole, "Creator application approved");
    if (applicantRole) await member.roles.remove(applicantRole, "Creator application approved").catch(() => undefined);
    const channel = await createCreatorChannel(interaction.guild, member);
    await sendCreatorManagerHandoff(interaction.guild, member, channel);
    await updateGuildState(interaction.guild.id, (state) => {
      if (!state.creatorIds.includes(userId)) state.creatorIds.push(userId);
    });
    await interaction.message.edit({
      content: `Approved by <@${interaction.user.id}> — private creator channel: <#${channel.id}>.`,
      components: [],
      allowedMentions: { users: [interaction.user.id] },
    });
  } else {
    if (applicantRole) await member.roles.remove(applicantRole, "Creator application rejected").catch(() => undefined);
    await interaction.message.edit({
      content: `Rejected by <@${interaction.user.id}>.`,
      components: [],
      allowedMentions: { users: [interaction.user.id] },
    });
  }
}

async function showHealth(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  await interaction.guild.channels.fetch();
  await interaction.guild.roles.fetch();
  const me = interaction.guild.members.me;
  const missingRoles = roles.filter((role) => !interaction.guild?.roles.cache.some((candidate) => candidate.name === role.name));
  const missingCategories = categories.filter(
    (category) => !interaction.guild?.channels.cache.some((channel) => channel.name === category.name && channel.isDMBased() === false),
  );
  const missingChannels = blueprintChannels.filter(
    (channel) => !interaction.guild?.channels.cache.some((candidate) => candidate.name === channel.name),
  );
  const adminRole = interaction.guild.roles.cache.find((role) => role.name === "Admin");
  const botAboveAdmin = Boolean(me && adminRole && me.roles.highest.comparePositionTo(adminRole) > 0);
  const checks = [
    ["Bot Administrator", Boolean(me?.permissions.has(PermissionFlagsBits.Administrator))],
    ["Bot role above Admin", botAboveAdmin],
    ["Community enabled", interaction.guild.features.includes(GuildFeature.Community)],
    ["Verification level Medium or lower", interaction.guild.verificationLevel <= GuildVerificationLevel.Medium],
    ["Rules channel present", interaction.guild.channels.cache.some((channel) => channel.name === "rules")],
    ["Required roles", missingRoles.length === 0],
    ["Required categories", missingCategories.length === 0],
    ["Required channels", missingChannels.length === 0],
  ] as const;
  const healthy = checks.every(([, passed]) => passed);
  const details = [
    ...checks.map(([name, passed]) => `${passed ? "✅" : "❌"} ${name}`),
    ...(missingRoles.length ? [`Missing roles: ${missingRoles.map((role) => role.name).join(", ")}`] : []),
    ...(missingCategories.length ? [`Missing categories: ${missingCategories.map((category) => category.name).join(", ")}`] : []),
    ...(missingChannels.length ? [`Missing channels: ${missingChannels.map((channel) => channel.name).join(", ")}`] : []),
  ];
  const embed = new EmbedBuilder()
    .setColor(healthy ? Colors.Green : Colors.Orange)
    .setTitle(healthy ? "Result Clanker is healthy" : "Result Clanker needs attention")
    .setDescription(details.join("\n"));
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function showHelp(interaction: ChatInputCommandInteraction): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle("Result Clanker")
    .setDescription(
      [
        "**Setup** — `/setup`, `/health`, `/creator-progress`",
        "**Creators** — `/add-creator`, `/delete-creator`, `/creator-assign`, `/creator-review`, `/issue-link`, `/delete-link`",
        "**Content** — Launchpoint is the source of truth for submissions and approvals",
        "**Launchpoint** — `/launchpoint creators|contracts|programs|kpis|leaderboard|payouts` (read-only)",
        "**Security** — `/set-key` explains how to configure a metrics key without posting it in Discord",
        "",
        "Members verify in `#verify`, then wait for staff approval. Approved creators receive the UGC channels and a private workspace.",
      ].join("\n"),
    );
  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function linkSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

async function addCreator(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const user = interaction.options.getUser("member", true);
  if (user.bot) {
    await interaction.editReply("Bot accounts cannot be added as creators.");
    return;
  }
  await setupGuild(interaction.guild);
  const member = await interaction.guild.members.fetch(user.id);
  const creatorRole = interaction.guild.roles.cache.find((role) => role.name === "Verified Creator");
  const memberRole = interaction.guild.roles.cache.find((role) => role.name === "Member");
  const applicantRole = interaction.guild.roles.cache.find((role) => role.name === "Applicant");
  if (creatorRole) await member.roles.add(creatorRole, "Added as a UGC creator");
  if (memberRole) await member.roles.add(memberRole, "Added as a UGC creator");
  if (applicantRole) await member.roles.remove(applicantRole, "Added as a UGC creator").catch(() => undefined);
  const channel = await createCreatorChannel(interaction.guild, member);
  await updateGuildState(interaction.guild.id, (state) => {
    if (!state.creatorIds.includes(user.id)) state.creatorIds.push(user.id);
  });
  await interaction.editReply(`Creator added: <#${channel.id}>.`);
}

async function deleteCreator(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.options.getBoolean("confirm", true)) {
    await interaction.editReply("Nothing was deleted. Run `/delete-creator` again with `confirm:true`.");
    return;
  }
  const user = interaction.options.getUser("member", true);
  const channel = findCreatorChannel(interaction.guild, user.id);
  if (!channel) {
    await interaction.editReply(`No private creator channel was found for <@${user.id}>.`);
    return;
  }
  await channel.delete(`Private creator channel deleted by ${interaction.user.tag}`);
  const dmSent = await user.send("Your Result Discord creator access has been removed, including your private creator channel. If you have questions, please contact the Result team directly.").then(() => true).catch(() => false);
  const member = await interaction.guild.members.fetch(user.id).catch(() => undefined);
  const kicked = member ? await member.kick("Creator removed from Discord program").then(() => true).catch(() => false) : false;
  await interaction.editReply(`Deleted <@${user.id}>'s private channel and ${kicked ? "kicked them from the server" : "could not kick them (they may already be gone or I lack permission)"}. DM ${dmSent ? "sent" : "could not be delivered"}. Their Launchpoint contract, mapping, and notes were left unchanged because Launchpoint does not provide a contract-cancellation API.`);
}

async function creatorReview(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const creator = interaction.options.getUser("creator", true);
  if (creator.bot) {
    await interaction.reply({ content: "Bot accounts cannot have creator reviews.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const note = interaction.options.getString("note")?.trim();
  const nextSteps = interaction.options.getString("next_steps")?.trim();
  const statusOverride = interaction.options.getString("status") as "active" | "inactive" | "watch" | null;
  const existingReview = (await getGuildState(interaction.guild.id)).creatorReviews.find((item) => item.creatorId === creator.id);
  let launchpointId = existingReview?.launchpointCreatorId;
  const state = await updateGuildState(interaction.guild.id, (current) => {
    let review = current.creatorReviews.find((item) => item.creatorId === creator.id);
    if (!review) {
      review = { creatorId: creator.id, notes: [], nextSteps: "Not set", updatedAt: new Date().toISOString() };
      current.creatorReviews.push(review);
    }
    if (note) review.notes.push(note.slice(0, 500));
    if (nextSteps) review.nextSteps = nextSteps.slice(0, 1_000);
    if (statusOverride) review.status = statusOverride;
    if (note || nextSteps || statusOverride) review.updatedAt = new Date().toISOString();
  });
  const review = state.creatorReviews.find((item) => item.creatorId === creator.id)!;
  type LaunchpointPost = { id?: string; crossPostGroupId?: string; contractorName?: string; creatorId?: string; uploadedAt?: number; url?: string; platform?: string; paid?: boolean };
  type LaunchpointCreator = { id: string; name: string; status?: string; campaigns?: Array<{ contractStatus?: string; programName?: string }> };
  let posts: LaunchpointPost[] = [];
  let lpCreator: LaunchpointCreator | undefined;
  try {
    if (!launchpointId) {
      const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
      const privateChannel = findCreatorChannel(interaction.guild, creator.id);
      const channelName = privateChannel?.name.replace(/^creator[-_]/i, "");
      const discordNames = [creator.username, creator.globalName, interaction.guild.members.cache.get(creator.id)?.displayName, channelName]
        .filter(Boolean).map((value) => normalize(value!));
      const matches = (await launchpointCreatorDirectory()).filter((candidate) => {
        const candidateName = normalize(candidate.name);
        const candidateTokens = candidate.name.split(/\s+/).map(normalize).filter(Boolean);
        return discordNames.includes(candidateName) || discordNames.some((name) => candidateTokens.includes(name));
      });
      if (matches.length === 1) {
        launchpointId = matches[0]!.id;
        await updateGuildState(interaction.guild.id, (current) => {
          const currentReview = current.creatorReviews.find((item) => item.creatorId === creator.id);
          if (currentReview) currentReview.launchpointCreatorId = launchpointId!;
        });
      } else {
        await interaction.editReply("I could not uniquely match this Discord member to a Launchpoint creator. Update the creator’s Launchpoint name or ask an admin to resolve the account link.");
        return;
      }
    }
    lpCreator = (await launchpointCreatorDirectory()).find((candidate) => candidate.id === launchpointId);
    const result = await launchpointGet<{ data?: LaunchpointPost[] }>("/posts", { limit: "500", creator: launchpointId });
    posts = result.data ?? [];
  } catch (error) {
    await interaction.editReply(`Launchpoint could not be read: ${error instanceof Error ? error.message : "unknown API error"}`);
    return;
  }
  if (!lpCreator) {
    await interaction.editReply(`Launchpoint creator ID **${launchpointId}** was not found for this API key. Check the launchpoint creators command and try again.`);
    return;
  }
  const latest = posts.map((item) => item.uploadedAt).filter((value): value is number => typeof value === "number").sort((a, b) => b - a)[0];
  const recent = latest ? Date.now() - latest <= 14 * 24 * 60 * 60 * 1_000 : false;
  const uniquePostCount = new Set(posts.map((post) => post.crossPostGroupId || post.id).filter(Boolean)).size;
  const contractActive = lpCreator?.status?.toLowerCase() === "active" || lpCreator?.campaigns?.some((campaign) => campaign.contractStatus?.toLowerCase() === "active");
  const derivedStatus = review.status ?? (contractActive || recent ? "active" : "inactive");
  const lastActivity = latest ? `<t:${Math.floor(latest / 1_000)}:R>` : "No Launchpoint posts recorded";
  const notes = review.notes.length ? review.notes.slice(-8).map((item, index) => `${index + 1}. ${item}`).join("\n") : "No private notes yet.";
  const embed = new EmbedBuilder()
    .setColor(derivedStatus === "active" ? Colors.Green : derivedStatus === "watch" ? Colors.Gold : Colors.Red)
    .setTitle(`Creator review · ${creator.globalName || creator.username}`)
    .setDescription(`<@${creator.id}> · **${derivedStatus.toUpperCase()}**${review.status ? " (manual status)" : " (based on last 14 days)"}`)
    .addFields(
      { name: "Launchpoint activity", value: `${uniquePostCount} unique post${uniquePostCount === 1 ? "" : "s"}\nContract status: ${lpCreator?.status || "Not returned"}\nLast post: ${lastActivity}`, inline: false },
      { name: "Next steps", value: review.nextSteps || "Not set", inline: false },
      { name: "Private notes", value: notes.slice(0, 1_000), inline: false },
    )
    .setFooter({ text: `Updated ${new Date(review.updatedAt).toLocaleString("en-US")}` });
  await interaction.editReply({ embeds: [embed], allowedMentions: { parse: [] } });
}

async function showCreatorAssignment(interaction: ChatInputCommandInteraction | ButtonInteraction, memberId: string): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const creators = await launchpointCreatorDirectory();
    if (!creators.length) {
      await interaction.editReply("Launchpoint returned no creators or tracked posts for this API key. Check the Launchpoint account scope, then try again.");
      return;
    }
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`creator-assign:${memberId}`)
      .setPlaceholder("Choose the Launchpoint creator")
      .addOptions(creators.slice(0, 25).map((creator) => ({
        label: creator.name.slice(0, 100),
        description: `${creator.status || "status unavailable"} · ${creator.id.slice(0, 20)}`.slice(0, 100),
        value: creator.id,
      })));
    await interaction.editReply({ content: `Select the Launchpoint creator to link to <@${memberId}>:`, components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)] });
  } catch (error) {
    await interaction.editReply(`Launchpoint could not be read: ${error instanceof Error ? error.message : "unknown API error"}`);
  }
}

async function assignCreator(interaction: ChatInputCommandInteraction): Promise<void> {
  const member = interaction.options.getUser("discord_member", true);
  await showCreatorAssignment(interaction, member.id);
}

async function completeCreatorAssignment(interaction: import("discord.js").StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild) return;
  const [, discordMemberId] = interaction.customId.split(":");
  const launchpointId = interaction.values[0];
  const creator = (await launchpointCreatorDirectory()).find((item) => item.id === launchpointId);
  if (!discordMemberId || !creator) {
    await interaction.reply({ content: "That creator list has expired. Run `/creator-assign` again.", flags: MessageFlags.Ephemeral });
    return;
  }
  await updateGuildState(interaction.guild.id, (state) => {
    let review = state.creatorReviews.find((item) => item.creatorId === discordMemberId);
    if (!review) {
      review = { creatorId: discordMemberId, notes: [], nextSteps: "Not set", updatedAt: new Date().toISOString() };
      state.creatorReviews.push(review);
    }
    review.launchpointCreatorId = creator.id;
    review.updatedAt = new Date().toISOString();
  });
  await interaction.update({ content: `Linked <@${discordMemberId}> to **${creator.name}** in Launchpoint.`, components: [] });
}

async function autocompleteLaunchpointCreator(interaction: import("discord.js").AutocompleteInteraction): Promise<void> {
  const focused = interaction.options.getFocused().toLowerCase();
  try {
    const creators = await launchpointCreatorDirectory();
    const choices = creators.filter((item) => !focused || `${item.name} ${item.id}`.toLowerCase().includes(focused)).slice(0, 25).map((item) => ({
      name: `${item.name} · ${item.status || "unknown"}`.slice(0, 100),
      value: item.id!,
    }));
    await interaction.respond(choices);
  } catch {
    await interaction.respond([]);
  }
}

async function issueCreatorLink(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  let creator = interaction.options.getUser("creator") ?? null;
  const isBotTestChannel = interaction.channel?.isTextBased() && !interaction.channel.isDMBased() && interaction.channel.name === "bot-tests";
  if (!creator) {
    const topic = interaction.channel && "topic" in interaction.channel ? interaction.channel.topic : undefined;
    const creatorId = topic?.match(/Creator ID:\s*(\d+)/)?.[1];
    if (creatorId) creator = await interaction.client.users.fetch(creatorId).catch(() => null);
  }
  if (!creator) {
    await interaction.reply({ content: isBotTestChannel ? "In `#bot-tests`, choose the `creator` option so I know who this test link is for." : "Run this inside a creator's private channel, or choose the `creator` option.", flags: MessageFlags.Ephemeral });
    return;
  }
  const creatorChannel = findCreatorChannel(interaction.guild, creator.id);
  if (!isBotTestChannel && (!creatorChannel || interaction.channelId !== creatorChannel.id)) {
    await interaction.reply({ content: "Run `/issue-link` inside that creator's private channel.", flags: MessageFlags.Ephemeral });
    return;
  }
  await interaction.deferReply();
  const destinationUrl = interaction.options.getString("url")?.trim() || process.env.DUB_DEFAULT_URL?.trim() || "https://result.dev";
  if (!isHttpsUrl(destinationUrl)) {
    await interaction.editReply("Use a valid HTTPS destination URL.");
    return;
  }
  const campaign = interaction.options.getString("campaign")?.trim() || "UGC";
  const partnerId = interaction.options.getString("partner_id")?.trim();
  const requestedKey = interaction.options.getString("key")?.trim();
  const key = linkSlug(requestedKey || creator.username);
  if (!key) {
    await interaction.editReply("I couldn't create a valid slug from that creator name. Choose a custom `key`.");
    return;
  }
  try {
    const link = await issueDubLink({
      creatorId: creator.id,
      creatorName: creator.username,
      destinationUrl,
      campaign,
      ...(partnerId ? { partnerId } : {}),
      ...(key ? { key } : {}),
    });
    await updateGuildState(interaction.guild.id, (state) => {
      state.creatorLinks.unshift({
        id: link.id,
        creatorId: creator.id,
        creatorName: creator.username,
        campaign,
        destinationUrl,
        shortLink: link.shortLink,
        createdAt: new Date().toISOString(),
      });
    });
    await interaction.editReply(`New **${campaign}** link for <@${creator.id}>: ${link.shortLink}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dub link creation failed.";
    await interaction.editReply(`Could not issue the Dub link: ${message}`);
  }
}

async function deleteCreatorLink(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.options.getBoolean("confirm", true)) {
    await interaction.editReply("Nothing was deleted. Run the command again with `confirm:true`.");
    return;
  }
  const needle = interaction.options.getString("link", true).trim();
  const state = await getGuildState(interaction.guild.id);
  const record = state.creatorLinks.find((link) => link.id === needle || link.shortLink === needle || link.shortLink.endsWith(`/${needle}`));
  if (!record) {
    await interaction.editReply("I couldn't find that link in this server's saved creator links.");
    return;
  }
  try {
    await deleteDubLink(record.id);
    await updateGuildState(interaction.guild.id, (current) => {
      current.creatorLinks = current.creatorLinks.filter((link) => link.id !== record.id);
    });
    await interaction.editReply(`Deleted the Dub link for **${record.creatorName}**: ${record.shortLink}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dub link deletion failed.";
    await interaction.editReply(`Could not delete the Dub link: ${message}`);
  }
}

type LaunchpointPage = { data?: Array<Record<string, unknown>>; total?: number };

function clipDiscord(value: string): string {
  return value.length > 1_900 ? `${value.slice(0, 1_890)}…` : value;
}

function launchpointDate(value: unknown): string {
  if (typeof value !== "number") return "";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function launchpointEmbed(title: string): EmbedBuilder {
  return new EmbedBuilder().setColor(Colors.Blurple).setTitle(title).setFooter({ text: "Launchpoint · read-only API" }).setTimestamp();
}

function launchpointField(value: string): string {
  return value.length > 1_000 ? `${value.slice(0, 990)}…` : value;
}

async function showLaunchpoint(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  // Launchpoint reports are intentionally public so the team can see the same
  // source-of-truth output in the channel where the command was run.
  await interaction.deferReply();
  const subcommand = interaction.options.getSubcommand();
  try {
    if (subcommand === "creators") {
      const result = await launchpointGet<LaunchpointPage>("/creators", { limit: "25", search: interaction.options.getString("search")?.trim(), programId: interaction.options.getString("program_id")?.trim() });
      const fields = (result.data ?? []).map((creator) => {
        const campaigns = Array.isArray(creator.campaigns) ? (creator.campaigns as Array<Record<string, unknown>>).map((campaign) => `${campaign.programName ?? campaign.programId}: ${campaign.contractStatus}`).join(", ") : "no campaign data";
        return { name: `${creator.name ?? creator.id} · ${creator.status ?? "unknown"}`.slice(0, 256), value: launchpointField(`Launchpoint ID: ${creator.id ?? "unknown"}\n${campaigns || "No campaign data"}`), inline: false };
      });
      const embed = launchpointEmbed(`Creators · ${result.total ?? fields.length}`);
      if (fields.length) embed.addFields(fields.slice(0, 25)); else embed.setDescription("No creators were returned by Launchpoint for this API key.");
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    if (subcommand === "contracts") {
      const result = await launchpointGet<LaunchpointPage>("/contracts", { limit: "25", status: interaction.options.getString("status") ?? undefined, creatorId: interaction.options.getString("creator_id")?.trim(), programId: interaction.options.getString("program_id")?.trim() });
      const fields = (result.data ?? []).map((contract) => ({ name: `${contract.contractorName ?? contract.contractorId} · ${contract.status ?? "unknown"}`.slice(0, 256), value: launchpointField(`${contract.contractName ?? "Contract"} · ID: ${contract.id ?? "unknown"}${contract.startsAt ? `\nStarts: ${launchpointDate(contract.startsAt)}` : ""}${contract.expiresAt ? `\nExpires: ${launchpointDate(contract.expiresAt)}` : ""}`), inline: false }));
      const embed = launchpointEmbed(`Contracts · ${result.total ?? fields.length}`);
      if (fields.length) embed.addFields(fields.slice(0, 25)); else embed.setDescription("Launchpoint returned 0 contracts for this API key and scope. This is an API-side data result, not a Discord rendering issue.");
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    if (subcommand === "programs") {
      const result = await launchpointGet<LaunchpointPage>("/programs", { limit: "25", status: interaction.options.getString("status") ?? undefined, search: interaction.options.getString("search")?.trim() });
      const fields = (result.data ?? []).map((program) => ({ name: `${program.name ?? program.id} · ${program.status ?? "unknown"}`.slice(0, 256), value: `ID: ${program.id ?? "unknown"}`, inline: false }));
      const embed = launchpointEmbed(`Programs · ${result.total ?? fields.length}`);
      if (fields.length) embed.addFields(fields.slice(0, 25)); else embed.setDescription("No programs were returned by Launchpoint.");
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    if (subcommand === "kpis") {
      const result = await launchpointGet<{ data?: Record<string, Record<string, number>> }>("/analytics/kpis");
      const embed = launchpointEmbed("Launchpoint KPIs");
      const fields = Object.entries(result.data ?? {}).map(([group, values]) => ({ name: group, value: Object.entries(values).map(([key, value]) => `**${key}**  ${value}`).join("\n") || "No values", inline: true }));
      if (fields.length) embed.addFields(fields); else embed.setDescription("No KPI data returned.");
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    if (subcommand === "leaderboard") {
      const programId = interaction.options.getString("program_id", true).trim();
      const result = await launchpointGet<{ data?: { summary?: Record<string, number>; topCreators?: Array<Record<string, unknown>> } }>("/analytics/leaderboard", { program: programId });
      const summary = result.data?.summary ?? {};
      const leaders = (result.data?.topCreators ?? []).slice(0, 15).map((creator, index) => `${index + 1}. **${creator.name ?? creator.id}** — ${creator.totalViews ?? 0} views · ${creator.totalPosts ?? 0} posts`);
      const embed = launchpointEmbed("🏆 Launchpoint leaderboard").setDescription(`**${summary.uniqueCreators ?? 0}** creators · **${summary.totalViews ?? 0}** views · **${summary.totalPosts ?? 0}** posts\n\n${leaders.join("\n") || "No leaderboard data returned."}`);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    const result = await launchpointGet<LaunchpointPage>("/payouts/pending", { limit: "25", creatorId: interaction.options.getString("creator_id")?.trim(), programId: interaction.options.getString("program_id")?.trim(), sortBy: "dueDate", sortOrder: "asc" });
    const fields = (result.data ?? []).map((payout) => ({ name: `${payout.creatorName ?? payout.creatorId} · ${payout.status ?? "pending"}`.slice(0, 256), value: `$${payout.amount ?? 0} ${payout.currency ?? "USD"}${payout.dueDate ? ` · due ${String(payout.dueDate).slice(0, 10)}` : ""}`, inline: true }));
    const embed = launchpointEmbed(`Pending payouts · ${result.total ?? fields.length}`);
    if (fields.length) embed.addFields(fields.slice(0, 25)); else embed.setDescription("No pending payouts were returned by Launchpoint.");
    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    await interaction.editReply(`Launchpoint request failed: ${error instanceof Error ? error.message : "unknown API error"}`);
  }
}

async function autocompleteDeleteLink(interaction: import("discord.js").AutocompleteInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.respond([]);
    return;
  }
  const focused = interaction.options.getFocused().toLowerCase();
  const state = await getGuildState(interaction.guild.id);
  const choices = state.creatorLinks
    .filter((link) => `${link.creatorName} ${link.campaign} ${link.shortLink}`.toLowerCase().includes(focused))
    .slice(0, 25)
    .map((link) => ({
      name: `${link.creatorName} · ${link.campaign} · ${link.shortLink}`.slice(0, 100),
      value: link.id,
    }));
  await interaction.respond(choices);
}

async function submitWork(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => undefined);
  const creatorRole = interaction.guild.roles.cache.find((role) => role.name === "Verified Creator");
  if (!member || !creatorRole || !member.roles.cache.has(creatorRole.id)) {
    await interaction.reply({ content: "Only verified creators can submit work.", flags: MessageFlags.Ephemeral });
    return;
  }
  const assetUrl = interaction.options.getString("asset_url", true).trim();
  if (!isHttpsUrl(assetUrl)) {
    await interaction.reply({ content: "Use a valid HTTPS asset link.", flags: MessageFlags.Ephemeral });
    return;
  }
  const channel = findCreatorChannel(interaction.guild, interaction.user.id);
  if (!channel) {
    await interaction.reply({ content: "Your private creator channel is missing. Ask staff to run `/add-creator`.", flags: MessageFlags.Ephemeral });
    return;
  }
  const campaign = interaction.options.getString("campaign", true).trim();
  const notes = interaction.options.getString("notes")?.trim() ?? "";
  const id = randomUUID().slice(0, 8);
  const now = new Date().toISOString();
  await updateGuildState(interaction.guild.id, (state) => {
    if (!state.creatorIds.includes(interaction.user.id)) state.creatorIds.push(interaction.user.id);
    state.submissions.unshift({
      id,
      creatorId: interaction.user.id,
      campaign,
      assetUrl,
      notes,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  });
  const embed = new EmbedBuilder()
    .setColor(Colors.Gold)
    .setTitle(`Submission ${id}`)
    .addFields(
      { name: "Creator", value: `<@${interaction.user.id}>`, inline: true },
      { name: "Campaign", value: campaign, inline: true },
      { name: "Status", value: "Pending", inline: true },
      { name: "Asset", value: assetUrl },
      ...(notes ? [{ name: "Notes", value: notes }] : []),
    )
    .setTimestamp();
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
  await interaction.reply({ content: `Submission **${id}** is ready for review in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
}

async function markSubmission(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const id = interaction.options.getString("submission", true).trim();
  const status = interaction.options.getString("status", true) as SubmissionStatus;
  const publishedUrl = interaction.options.getString("published_url")?.trim();
  if (publishedUrl && !isHttpsUrl(publishedUrl)) {
    await interaction.reply({ content: "The published URL must use HTTPS.", flags: MessageFlags.Ephemeral });
    return;
  }
  let found = false;
  let creatorId = "";
  let campaign = "";
  await updateGuildState(interaction.guild.id, (state) => {
    const submission = state.submissions.find((candidate) => candidate.id === id);
    if (!submission) return;
    found = true;
    creatorId = submission.creatorId;
    campaign = submission.campaign;
    submission.status = status;
    submission.updatedAt = new Date().toISOString();
    if (publishedUrl) submission.publishedUrl = publishedUrl;
  });
  if (!found) {
    await interaction.reply({ content: `Submission **${id}** was not found.`, flags: MessageFlags.Ephemeral });
    return;
  }
  const creatorChannel = findCreatorChannel(interaction.guild, creatorId);
  await creatorChannel?.send({
    content: `Submission **${id}** (${campaign}) is now **${status}**.${publishedUrl ? `\n${publishedUrl}` : ""}`,
    allowedMentions: { parse: [] },
  });
  if (status === "approved" || status === "posted") {
    await findTextChannel(interaction.guild, "approved-content")?.send({
      content: `**${id}** — <@${creatorId}> — ${campaign} — **${status}**${publishedUrl ? `\n${publishedUrl}` : ""}`,
      allowedMentions: { parse: [] },
    });
  }
  await interaction.reply({ content: `Submission **${id}** marked **${status}**.`, flags: MessageFlags.Ephemeral });
}

async function listSubmissions(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const creator = interaction.options.getUser("creator");
  const status = interaction.options.getString("status") as SubmissionStatus | null;
  const state = await getGuildState(interaction.guild.id);
  const matches = state.submissions
    .filter((item) => (!creator || item.creatorId === creator.id) && (!status || item.status === status))
    .slice(0, 15);
  const description = matches.length
    ? matches.map((item) => `**${item.id}** · <@${item.creatorId}> · ${item.campaign} · **${item.status}**`).join("\n")
    : "No matching submissions.";
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(Colors.Blurple).setTitle("Recent submissions").setDescription(description)],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

async function showPostingStatus(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const state = await getGuildState(interaction.guild.id);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1_000;
  const lines = state.creatorIds.map((creatorId) => {
    const count = state.submissions.filter(
      (item) => item.creatorId === creatorId && new Date(item.createdAt).getTime() >= weekAgo,
    ).length;
    return `${count >= state.quota ? "✅" : "⚠️"} <@${creatorId}> — **${count}/${state.quota}**`;
  });
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(Colors.Blurple).setTitle("Weekly posting status").setDescription(lines.join("\n") || "No creators yet.")],
    flags: MessageFlags.Ephemeral,
    allowedMentions: { parse: [] },
  });
}

async function showLeaderboard(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const state = await getGuildState(interaction.guild.id);
  const ranked = state.creatorIds
    .map((creatorId) => ({
      creatorId,
      points: state.submissions.filter((item) => item.creatorId === creatorId && item.status === "posted").length * 2
        + state.submissions.filter((item) => item.creatorId === creatorId && item.status === "approved").length,
    }))
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);
  const lines = ranked.map((row, index) => `${index + 1}. <@${row.creatorId}> — **${row.points}** points`);
  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(Colors.Gold).setTitle("Creator leaderboard").setDescription(lines.join("\n") || "No creator results yet.")],
    allowedMentions: { parse: [] },
  });
}

async function exportProgram(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const state = await getGuildState(interaction.guild.id);
  const rows = [
    ["submission_id", "creator_id", "campaign", "status", "asset_url", "published_url", "created_at", "updated_at"],
    ...state.submissions.map((item) => [
      item.id,
      item.creatorId,
      item.campaign,
      item.status,
      item.assetUrl,
      item.publishedUrl ?? "",
      item.createdAt,
      item.updatedAt,
    ]),
  ];
  const csv = `${rows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`;
  await interaction.reply({
    content: `${state.creatorIds.length} creators · ${state.submissions.length} submissions`,
    files: [{ attachment: Buffer.from(csv, "utf8"), name: "ugc-submissions.csv" }],
    flags: MessageFlags.Ephemeral,
  });
}

function callPollEmbed(poll: CallPollRecord): EmbedBuilder {
  const counts = new Map<string, number>();
  for (const response of Object.values(poll.responses)) {
    for (const slotId of response.slotIds) counts.set(slotId, (counts.get(slotId) ?? 0) + 1);
  }
  const best = poll.slots
    .map((slot) => ({ slot, count: counts.get(slot.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.slot.startsAt.localeCompare(b.slot.startsAt))
    .slice(0, 5);
  const bestText = best.some((item) => item.count > 0)
    ? best.filter(({ count }) => count > 0).slice(0, 3).map(({ slot, count }, index) => `${index + 1}. **${formatSlot(slot.startsAt, "est").replace(/,?\s*(EST|EDT)$/i, " ET")}** · ${formatSlot(slot.startsAt, "pst").replace(/,?\s*(PST|PDT)$/i, " PT")} · ${formatSlot(slot.startsAt, "ist").replace(/,?\s*(GMT\+5:30|IST)$/i, " IST")} — **${count}**`).join("\n")
    : "No responses yet — choose your timezone below to vote.";
  return new EmbedBuilder()
    .setColor(Colors.Blurple)
    .setTitle(`📅 Creator call · week of ${poll.weekStart}`)
    .setDescription("Choose your timezone → pick days → pick every time that works.")
    .addFields(
      { name: "Best times", value: bestText },
    )
    .setFooter({ text: `${Object.keys(poll.responses).length} response(s) · ${poll.durationMinutes} min · Times shown in ET / PT / IST` })
    .setTimestamp();
}

function callTimezoneRow(pollId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder().setCustomId(`call:timezone:${pollId}`).setPlaceholder("Choose your timezone");
  menu.addOptions(Object.entries(CALL_TIMEZONES).map(([value, info]) => new StringSelectMenuOptionBuilder().setLabel(info.label).setValue(value)));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function callDateRow(pollId: string, poll: CallPollRecord, timezone: CallTimezone): ActionRowBuilder<StringSelectMenuBuilder> {
  const now = Date.now();
  const dates = [...new Set(poll.slots.filter((slot) => new Date(slot.startsAt).getTime() > now).map((slot) => slot.id.slice(0, 10)))];
  const menu = new StringSelectMenuBuilder().setCustomId(`call:date:${pollId}`).setPlaceholder("Choose a day");
  menu.addOptions(dates.map((date) => new StringSelectMenuOptionBuilder().setLabel(dateLabel(date, timezone)).setValue(date)));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function callTimeRow(pollId: string, poll: CallPollRecord, date: string, timezone: CallTimezone): ActionRowBuilder<StringSelectMenuBuilder> {
  const slots = poll.slots.filter((slot) => slot.id.startsWith(`${date}-`) && new Date(slot.startsAt).getTime() > Date.now());
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`call:time:${pollId}:${date}`)
    .setPlaceholder("Choose all times you can make")
    .setMinValues(1)
    .setMaxValues(Math.min(5, slots.length));
  menu.addOptions(slots.map((slot) => new StringSelectMenuOptionBuilder()
    .setLabel(formatSlot(slot.startsAt, timezone).replace(/,?\s*(EST|EDT|PST|PDT|IST|GMT\+5:30)$/i, ""))
    .setDescription(`${CALL_TIMEZONES[timezone].label} · ${poll.durationMinutes} min`)
    .setValue(slot.id)));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

async function refreshCallPoll(guild: Guild, poll: CallPollRecord): Promise<void> {
  if (!poll.messageId) return;
  const channel = await guild.channels.fetch(poll.channelId).catch(() => null);
  if (!channel?.isTextBased() || channel.isDMBased()) return;
  const message = await channel.messages.fetch(poll.messageId).catch(() => null);
  await message?.edit({ embeds: [callPollEmbed(poll)], components: [callTimezoneRow(poll.id)] }).catch(() => undefined);
}

async function createGroupCall(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild || !interaction.channel?.isTextBased() || interaction.channel.isDMBased()) return;
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const weekStart = interaction.options.getString("week_start")?.trim() || currentMondayUtc();
  if (!validDate(weekStart)) {
    await interaction.editReply("`week_start` must be a real date in YYYY-MM-DD format.");
    return;
  }
  const baseTimezone = (interaction.options.getString("base_timezone") || "est") as CallTimezone;
  const durationMinutes = interaction.options.getInteger("duration") || 30;
  const poll: CallPollRecord = {
    id: randomUUID().slice(0, 8),
    channelId: interaction.channel.id,
    createdBy: interaction.user.id,
    weekStart,
    baseTimezone,
    durationMinutes,
    slots: generateCallSlots(weekStart, baseTimezone, durationMinutes),
    responses: {},
  };
  const message = await interaction.channel.send({ embeds: [callPollEmbed(poll)], components: [callTimezoneRow(poll.id)] });
  poll.messageId = message.id;
  await updateGuildState(interaction.guild.id, (state) => {
    state.callPolls = [poll, ...state.callPolls].slice(0, 20);
  });
  await interaction.editReply(`Weekly call poll posted in <#${interaction.channel.id}>.`);
}

async function showGroupCallResults(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  const state = await getGuildState(interaction.guild.id);
  const poll = state.callPolls.find((item) => item.channelId === interaction.channelId) ?? state.callPolls[0];
  if (!poll) {
    await interaction.reply({ content: "There isn't a group-call poll yet. Run `/group-call` first.", flags: MessageFlags.Ephemeral });
    return;
  }
  const counts = new Map<string, number>();
  for (const response of Object.values(poll.responses)) {
    for (const slotId of response.slotIds) counts.set(slotId, (counts.get(slotId) ?? 0) + 1);
  }
  const ranked = poll.slots.map((slot) => ({ slot, count: counts.get(slot.id) ?? 0 }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || a.slot.startsAt.localeCompare(b.slot.startsAt))
    .slice(0, 10);
  const description = ranked.length
    ? ranked.map(({ slot, count }, index) => `${index === 0 ? "🏆" : `${index + 1}.`} **${formatSlot(slot.startsAt, "est").replace(/,?\s*(EST|EDT)$/i, " ET")}** · ${formatSlot(slot.startsAt, "pst").replace(/,?\s*(PST|PDT)$/i, " PT")} · ${formatSlot(slot.startsAt, "ist").replace(/,?\s*(GMT\+5:30|IST)$/i, " IST")} — **${count} vote${count === 1 ? "" : "s"}**`).join("\n")
    : "No one has submitted availability yet.";
  const embed = new EmbedBuilder()
    .setColor(ranked.length ? Colors.Green : Colors.Orange)
    .setTitle(`📊 Group-call results · week of ${poll.weekStart}`)
    .setDescription(description)
    .setFooter({ text: `${Object.keys(poll.responses).length} response(s) · ${poll.durationMinutes} min` });
  await interaction.reply({ embeds: [embed] });
}

async function resetGroupCall(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (!interaction.options.getBoolean("confirm", true)) {
    await interaction.reply({ content: "Nothing was reset. Run `/group-call-reset confirm:true` to clear this week's responses.", flags: MessageFlags.Ephemeral });
    return;
  }
  const state = await getGuildState(interaction.guild.id);
  const poll = state.callPolls.find((item) => item.channelId === interaction.channelId) ?? state.callPolls[0];
  if (!poll) {
    await interaction.reply({ content: "There isn't a group-call poll to reset.", flags: MessageFlags.Ephemeral });
    return;
  }
  const updated = await updateGuildState(interaction.guild.id, (current) => {
    const currentPoll = current.callPolls.find((item) => item.id === poll.id);
    if (!currentPoll) return;
    currentPoll.responses = {};
    if (!currentPoll.slots.some((slot) => new Date(slot.startsAt).getTime() > Date.now())) {
      currentPoll.weekStart = nextMondayUtc();
      currentPoll.slots = generateCallSlots(currentPoll.weekStart, currentPoll.baseTimezone, currentPoll.durationMinutes);
    }
  });
  const updatedPoll = updated.callPolls.find((item) => item.id === poll.id);
  if (updatedPoll) await refreshCallPoll(interaction.guild, updatedPoll);
  const rolledForward = updatedPoll?.weekStart !== poll.weekStart;
  await interaction.reply({ content: rolledForward
    ? `Votes reset. The previous week had no future slots, so this poll is now ready for the week of **${updatedPoll?.weekStart}**.`
    : `Reset responses for the week of **${poll.weekStart}**. Everyone can vote again on the existing poll.`, flags: MessageFlags.Ephemeral });
}

async function handleCallSelect(interaction: import("discord.js").StringSelectMenuInteraction): Promise<void> {
  if (!interaction.guild) return;
  const parts = interaction.customId.split(":");
  const action = parts[1];
  const pollId = parts[2]!;
  const state = await getGuildState(interaction.guild.id);
  const poll = state.callPolls.find((item) => item.id === pollId);
  if (!poll) {
    await interaction.reply({ content: "That call poll has expired.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (action === "timezone") {
    const timezone = interaction.values[0] as CallTimezone;
    await updateGuildState(interaction.guild.id, (current) => {
      const currentPoll = current.callPolls.find((item) => item.id === pollId);
      if (currentPoll) currentPoll.responses[interaction.user.id] = { timezone, slotIds: currentPoll.responses[interaction.user.id]?.slotIds ?? [] };
    });
    const dateRow = callDateRow(pollId, poll, timezone);
    if (!dateRow.components[0]?.options?.length) {
      await interaction.reply({ content: "There are no call slots left this week. Ask the organizer to post next week's poll.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content: "Timezone saved. Choose a day:", components: [dateRow], flags: MessageFlags.Ephemeral });
    return;
  }
  if (action === "date") {
    const date = interaction.values[0]!;
    const timezone = poll.responses[interaction.user.id]?.timezone ?? poll.baseTimezone;
    if (!poll.slots.some((slot) => slot.id.startsWith(`${date}-`) && new Date(slot.startsAt).getTime() > Date.now())) {
      await interaction.reply({ content: "Those slots have passed. Choose another day.", flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.reply({ content: "Choose every time that works for you:", components: [callTimeRow(pollId, poll, date, timezone)], flags: MessageFlags.Ephemeral });
    return;
  }
  if (action === "time") {
    const selected = interaction.values;
    await updateGuildState(interaction.guild.id, (current) => {
      const currentPoll = current.callPolls.find((item) => item.id === pollId);
      if (!currentPoll) return;
      const existing = currentPoll.responses[interaction.user.id];
      currentPoll.responses[interaction.user.id] = { timezone: existing?.timezone ?? currentPoll.baseTimezone, slotIds: [...new Set([...(existing?.slotIds ?? []), ...selected])] };
    });
    const updated = await getGuildState(interaction.guild.id);
    const updatedPoll = updated.callPolls.find((item) => item.id === pollId);
    if (updatedPoll) await refreshCallPoll(interaction.guild, updatedPoll);
    const timezone = updatedPoll?.responses[interaction.user.id]?.timezone ?? poll.baseTimezone;
    await interaction.reply({ content: `Saved ${selected.length} slot(s). Choose another day to add more availability:`, components: [callDateRow(pollId, updatedPoll ?? poll, timezone)], flags: MessageFlags.Ephemeral });
  }
}

async function handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) return;
  if (interaction.commandName === "add-creator") {
    await addCreator(interaction);
    return;
  }
  if (interaction.commandName === "delete-creator") {
    await deleteCreator(interaction);
    return;
  }
  if (interaction.commandName === "creator-progress") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await runReminderSweep(interaction.client, true);
    await interaction.editReply("Posted the current Launchpoint creator progress report in #onboarding-alerts.");
    return;
  }
  if (interaction.commandName === "creator-review") {
    await creatorReview(interaction);
    return;
  }
  if (interaction.commandName === "creator-assign") {
    await assignCreator(interaction);
    return;
  }
  if (interaction.commandName === "issue-link") {
    await issueCreatorLink(interaction);
    return;
  }
  if (interaction.commandName === "delete-link") {
    await deleteCreatorLink(interaction);
    return;
  }
  if (interaction.commandName === "launchpoint") {
    await showLaunchpoint(interaction);
    return;
  }
  if (interaction.commandName === "group-call") {
    await createGroupCall(interaction);
    return;
  }
  if (interaction.commandName === "group-call-results") {
    await showGroupCallResults(interaction);
    return;
  }
  if (interaction.commandName === "group-call-reset") {
    await resetGroupCall(interaction);
    return;
  }
  if (interaction.commandName === "export") {
    await exportProgram(interaction);
    return;
  }
  if (interaction.commandName === "health") {
    await showHealth(interaction);
    return;
  }
  if (interaction.commandName === "help") {
    await showHelp(interaction);
    return;
  }
  if (interaction.commandName === "leaderboard") {
    await showLeaderboard(interaction);
    return;
  }
  if (interaction.commandName === "mark") {
    await markSubmission(interaction);
    return;
  }
  if (interaction.commandName === "onboarding-sessions") {
    const log = findTextChannel(interaction.guild, "onboarding-alerts");
    const messages = log ? await log.messages.fetch({ limit: 20 }) : undefined;
    const lines = messages
      ?.filter((message) => message.author.id === interaction.client.user.id && message.content.includes("verification"))
      .map((message) => `${message.content} · <t:${Math.floor(message.createdTimestamp / 1_000)}:R>`)
      .slice(0, 10);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Blurple).setTitle("Recent onboarding sessions").setDescription(lines?.join("\n") || "No verification activity yet.")],
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
    return;
  }
  if (interaction.commandName === "posting-status") {
    await showPostingStatus(interaction);
    return;
  }
  if (interaction.commandName === "program-remove") {
    const confirmed = interaction.options.getBoolean("confirm", true);
    if (!confirmed) {
      await interaction.reply({ content: "Nothing was removed.", flags: MessageFlags.Ephemeral });
      return;
    }
    const removed = await removeGuildState(interaction.guild.id);
    await interaction.reply({
      content: removed
        ? "Saved program data was removed. Discord roles and channels were left untouched."
        : "There was no saved program data to remove.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.commandName === "programs") {
    const state = await getGuildState(interaction.guild.id);
    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(Colors.Blurple).setTitle(state.programName).setDescription(
        `${state.creatorIds.length} creators · ${state.submissions.length} submissions · weekly quota ${state.quota} · trial ${state.trialDays || "off"}${state.trialDays ? " days" : ""}`,
      )],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.commandName === "quickstart") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const name = interaction.options.getString("name")?.trim();
    if (name) await updateGuildState(interaction.guild.id, (state) => { state.programName = name.slice(0, 100); });
    const result = await setupGuild(interaction.guild);
    await interaction.editReply(setupSummary(result));
    return;
  }
  if (interaction.commandName === "refresh-metrics") {
    const state = await updateGuildState(interaction.guild.id, (current) => {
      current.lastMetricsRefresh = new Date().toISOString();
    });
    const approved = state.submissions.filter((item) => item.status === "approved").length;
    const posted = state.submissions.filter((item) => item.status === "posted").length;
    await interaction.reply({
      content: `Metrics refreshed: **${state.creatorIds.length}** creators, **${state.submissions.length}** submissions, **${approved}** approved, **${posted}** posted.`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.commandName === "reminders") {
    const enabled = interaction.options.getBoolean("enabled", true);
    await updateGuildState(interaction.guild.id, (state) => { state.remindersEnabled = enabled; });
    await interaction.reply({ content: `Daily posting reminders are now **${enabled ? "on" : "off"}**.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.commandName === "reset-onboarding") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const user = interaction.options.getUser("member", true);
    const member = await interaction.guild.members.fetch(user.id).catch(() => undefined);
    if (!member) {
      await interaction.editReply("That member is not in this server.");
      return;
    }
    for (const roleName of ["Member", "Verified Creator", "Applicant"]) {
      const role = interaction.guild.roles.cache.find((candidate) => candidate.name === roleName);
      if (role) await member.roles.remove(role, "Reset UGC onboarding");
    }
    const creatorChannel = findCreatorChannel(interaction.guild, user.id);
    if (creatorChannel) await creatorChannel.permissionOverwrites.delete(user.id, "Reset UGC onboarding");
    await updateGuildState(interaction.guild.id, (state) => {
      state.creatorIds = state.creatorIds.filter((id) => id !== user.id);
    });
    await interaction.editReply(`Onboarding reset for <@${user.id}>. Their private channel was preserved for staff records.`);
    return;
  }
  if (interaction.commandName === "set-key") {
    await interaction.reply({
      content: "For safety, Result Clanker never accepts API keys through Discord. Add `METRICS_API_KEY=...` to the bot's local `.env`, then restart it.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (interaction.commandName === "set-quota") {
    const quota = interaction.options.getInteger("posts", true);
    await updateGuildState(interaction.guild.id, (state) => { state.quota = quota; });
    await interaction.reply({ content: `Weekly quota set to **${quota}** submissions per creator.`, flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.commandName === "set-trial") {
    const days = interaction.options.getInteger("days", true);
    await updateGuildState(interaction.guild.id, (state) => { state.trialDays = days; });
    await interaction.reply({ content: days ? `Creator trial set to **${days} days**.` : "Creator trials are now off.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (interaction.commandName === "setup" || interaction.commandName === "setup-onboarding") {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const result = await setupGuild(interaction.guild);
    await interaction.editReply(setupSummary(result));
    return;
  }
  if (interaction.commandName === "submissions") {
    await listSubmissions(interaction);
    return;
  }
}

export async function handleInteraction(interaction: Interaction): Promise<void> {
  try {
    if (interaction.isAutocomplete() && interaction.commandName === "delete-link") await autocompleteDeleteLink(interaction);
    else if (interaction.isAutocomplete() && interaction.commandName === "creator-assign") await autocompleteLaunchpointCreator(interaction);
    else if (interaction.isChatInputCommand()) await handleCommand(interaction);
    else if (interaction.isStringSelectMenu() && interaction.customId.startsWith("creator-assign:")) await completeCreatorAssignment(interaction);
    else if (interaction.isStringSelectMenu() && interaction.customId.startsWith("call:")) await handleCallSelect(interaction);
    else if (interaction.isButton() && interaction.customId === "verify:member") await handleVerify(interaction);
    else if (interaction.isButton() && interaction.customId.startsWith("creator-assign:start:")) {
      if (!isStaff(interaction)) {
        await interaction.reply({ content: "Only the moderation team can link Launchpoint creators.", flags: MessageFlags.Ephemeral });
      } else {
        const [, , memberId] = interaction.customId.split(":");
        if (memberId) await showCreatorAssignment(interaction, memberId);
      }
    }
    else if (interaction.isButton() && interaction.customId.startsWith("creator:")) {
      const [, action, userId] = interaction.customId.split(":");
      if ((action === "approve" || action === "reject") && userId) {
        await handleCreatorDecision(interaction, action, userId);
      }
    }
  } catch (error) {
    console.error("Interaction failed", error);
    const content = "Something went wrong. Ask an admin to run `/health`.";
    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
      } else {
        await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => undefined);
      }
    }
  }
}
