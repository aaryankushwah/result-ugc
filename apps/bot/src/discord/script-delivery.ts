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
 * Pure so it can be unit tested without a Discord client.
 */
export function buildScriptAssignmentMessage(input: ScriptAssignmentPayload & { discordUserId: string }): {
  content: string;
  embed: EmbedBuilder;
} {
  const url = scriptShareUrl(input.shareToken);
  const lines = [`**New script for you** · <@${input.discordUserId}>`];
  if (input.dueAt) lines.push(`Due ${formatDue(input.dueAt)}.`);
  lines.push(url ? `Open it here: ${url}` : "Your manager will share the script link shortly.");

  const embed = new EmbedBuilder()
    .setTitle(input.scriptTitle)
    .setColor(0xa9_95_ff);

  const description = [input.scriptHook, input.message].filter((value): value is string => Boolean(value?.trim())).join("\n\n");
  if (description) embed.setDescription(clip(description, 4_000));
  if (url) embed.setURL(url);
  if (input.dueAt) embed.addFields({ name: "Due", value: formatDue(input.dueAt), inline: true });

  return { content: lines.join("\n"), embed };
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
): Promise<{ channelId: string; messageId: string }> {
  const channel = await resolveCreatorChannel(guild, target);
  if (!channel) throw new Error("The creator has no private channel and one could not be created");

  const { content, embed } = buildScriptAssignmentMessage({ ...payload, discordUserId: target.discordUserId });
  const message = await channel.send({
    content,
    embeds: [embed],
    allowedMentions: { users: [target.discordUserId] },
  });
  return { channelId: channel.id, messageId: message.id };
}

async function resolveCreatorChannel(
  guild: Guild,
  target: { discordUserId: string; privateChannelId: string | null },
): Promise<TextChannel | null> {
  if (target.privateChannelId) {
    const mapped = await guild.channels.fetch(target.privateChannelId).catch(() => null);
    if (mapped?.isTextBased() && !mapped.isThread()) return mapped as TextChannel;
  }
  const byMarker = findCreatorChannel(guild, target.discordUserId);
  if (byMarker) return byMarker;

  const member = await guild.members.fetch(target.discordUserId).catch(() => null);
  if (!member) return null;
  return createCreatorChannel(guild, member);
}
