import type { Client, GuildTextBasedChannel } from "discord.js";
import { getGuildState, updateGuildState } from "../data/store.js";
import { launchpointGet } from "../integrations/launchpoint.js";
import { currentMondayUtc, nextMondayUtc } from "./calls.js";
import { findCreatorChannel } from "./setup.js";

const WEEKLY_MINIMUM_POSTS = 7;

function teamChannel(client: Client, guildId: string): GuildTextBasedChannel | undefined {
  const guild = client.guilds.cache.get(guildId);
  const channel = guild?.channels.cache.find((candidate) => candidate.name === "onboarding-alerts" && candidate.isTextBased());
  return channel?.isTextBased() && !channel.isDMBased() ? channel : undefined;
}

export async function runReminderSweep(client: Client, force = false): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = currentMondayUtc();
  const weekEnd = new Date(Date.parse(`${nextMondayUtc()}T00:00:00Z`) - 24 * 60 * 60 * 1_000).toISOString().slice(0, 10);
  for (const guild of client.guilds.cache.values()) {
    const state = await getGuildState(guild.id);
    if (!force && state.lastCreatorFollowupDate === today) continue;
    const mappedCreators = state.creatorReviews.filter((review) => review.launchpointCreatorId);
    if (!mappedCreators.length) continue;
    const counts = await Promise.all(mappedCreators.map(async (review) => {
      try {
        const result = await launchpointGet<{ data?: Array<{ id?: string; crossPostGroupId?: string }> }>("/posts", {
          limit: "500",
          creator: review.launchpointCreatorId,
          fromDate: weekStart,
          toDate: weekEnd,
        });
        const uniquePosts = new Set((result.data ?? []).map((post) => post.crossPostGroupId || post.id).filter(Boolean));
        return { review, count: uniquePosts.size };
      } catch (error) {
        console.error(`Launchpoint weekly count failed for ${guild.id}/${review.creatorId}:`, error);
        return undefined;
      }
    }));
    const validCounts = counts.filter((value): value is { review: typeof mappedCreators[number]; count: number } => Boolean(value));
    if (!validCounts.length) continue;
    await Promise.all(validCounts.map(async ({ review, count }) => {
      const creatorChannel = findCreatorChannel(guild, review.creatorId);
      if (!creatorChannel) return;
      const complete = count >= WEEKLY_MINIMUM_POSTS;
      await creatorChannel.send({
        content: [
          `**Weekly post check-in** · <@${review.creatorId}>`,
          `You’re at **${count}/${WEEKLY_MINIMUM_POSTS} posts** this week.${complete ? " ✅ Minimum reached." : ` **${WEEKLY_MINIMUM_POSTS - count} left** to reach the minimum.`}`,
          "Keep going — your Launchpoint submissions are the source of truth.",
        ].join("\n"),
        allowedMentions: { users: [review.creatorId] },
      }).catch((error) => console.error(`Creator channel reminder failed for ${guild.id}/${review.creatorId}:`, error));
    }));
    const done = validCounts.filter(({ count }) => count >= WEEKLY_MINIMUM_POSTS).length;
    const lines = validCounts.map(({ review, count }) => `<@${review.creatorId}> — **${count}/${WEEKLY_MINIMUM_POSTS}**${count >= WEEKLY_MINIMUM_POSTS ? " ✅" : ` · ${WEEKLY_MINIMUM_POSTS - count} left`}`);
    await teamChannel(client, guild.id)?.send({
      content: `**Daily creator progress** — **${done}/${validCounts.length}** mapped creators have reached the **${WEEKLY_MINIMUM_POSTS}-post minimum** this week.\n${lines.join("\n")}`,
      allowedMentions: { parse: [] },
    }).catch((error) => console.error(`Creator progress summary failed for ${guild.id}:`, error));
    await updateGuildState(guild.id, (current) => { current.lastCreatorFollowupDate = today; });
  }
}
