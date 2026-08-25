import { EmbedBuilder, type Guild, type TextChannel } from "discord.js";
import { createCreatorChannel, findCreatorChannel } from "./setup.js";

export type ScriptAssignmentPayload = {
  scriptTitle: string;
  scriptHook: string | null;
  shareToken: string | null;
  dueAt: string | null;
  message: string | null;
};

export function scriptShareUrl(shareToken: string | null): string | null {
  const base = process.env.RESULT_PORTAL_URL?.trim().replace(/\/+$/, "");
  if (!base || !shareToken) return null;
  return `${base}/s/${shareToken}`;
}

/**
 * Builds the private-channel message for a newly assigned script.
 * Deliberately carries no transcript preview — a raw hook dump reads as a wall
 * of truncated text in Discord. The link is the way in.
 * Pure so it can be unit tested without a Discord client.
 */
export function buildScriptAssignmentMessage(input: ScriptAssignmentPayload & { discordUserId: string }): {
  content: string;
  embed: EmbedBuilder;
} {
  const url = scriptShareUrl(input.shareToken);
  const embed = new EmbedBuilder()
    .setTitle(clip(cleanTitle(input.scriptTitle), 240))
    .setColor(0xa9_95_ff);
  if (url) embed.setURL(url);

  const facts: string[] = ["Ready to film"];
  if (input.dueAt) facts.push(`Due ${formatDue(input.dueAt)}`);
  embed.addFields({ name: "Status", value: facts.join(" · "), inline: false });

  if (input.message?.trim()) {
    embed.addFields({ name: "From your manager", value: clip(input.message.trim(), 1_000), inline: false });
  }
  embed.addFields({
    name: "Script",
    value: url ? `[Open the full script](${url})` : "Your manager will share the link shortly.",
    inline: false,
  });

  return { content: `**New script for you** · <@${input.discordUserId}>`, embed };
}

/** Reference titles are often raw captions; drop trailing hashtag spam. */
export function cleanTitle(title: string): string {
  const withoutTags = title.replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, " ").replace(/\s+/g, " ").trim();
  return withoutTags || title.trim() || "Untitled script";
}

function formatDue(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `<t:${Math.floor(date.getTime() / 1_000)}:D>`;
}

function clip(value: string, limit: number): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

/**
 * Resolves a creator's private channel and posts to it.
 * Prefers the mapped channel id, falls back to the topic marker, and finally
 * creates the channel so a notification is never silently dropped.
 */
export async function postToCreatorChannel(
  guild: Guild,
  target: { discordUserId: string; privateChannelId: string | null },
  payload: ScriptAssignmentPayload,
  deps: ChannelResolverDeps = defaultChannelResolverDeps,
): Promise<{ channelId: string; messageId: string }> {
  const channel = await resolveCreatorChannel(guild, target, deps);
  if (!channel) throw new Error("The creator has no private channel and one could not be created");

  const { content, embed } = buildScriptAssignmentMessage({ ...payload, discordUserId: target.discordUserId });
  const message = await channel.send({
    content,
    embeds: [embed],
    allowedMentions: { users: [target.discordUserId] },
  });
  return { channelId: channel.id, messageId: message.id };
}

/** Injectable so the resolution order can be unit tested without a Discord client. */
export type ChannelResolverDeps = {
  findCreatorChannel: typeof findCreatorChannel;
  createCreatorChannel: typeof createCreatorChannel;
};

export const defaultChannelResolverDeps: ChannelResolverDeps = { findCreatorChannel, createCreatorChannel };

/**
 * Resolves a creator's private channel, most-trusted source first:
 * the mapped channel id, then Discord's own `Creator ID:` topic marker, and
 * finally creating the channel so a notification is never silently dropped.
 */
export async function resolveCreatorChannel(
  guild: Guild,
  target: { discordUserId: string; privateChannelId: string | null },
  deps: ChannelResolverDeps = defaultChannelResolverDeps,
): Promise<TextChannel | null> {
  if (target.privateChannelId) {
    const mapped = await guild.channels.fetch(target.privateChannelId).catch(() => null);
    if (mapped?.isTextBased() && !mapped.isThread()) return mapped as TextChannel;
  }
  const byMarker = deps.findCreatorChannel(guild, target.discordUserId);
  if (byMarker) return byMarker;

  const member = await guild.members.fetch(target.discordUserId).catch(() => null);
  if (!member) return null;
  return deps.createCreatorChannel(guild, member);
}
