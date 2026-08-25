import { Colors, EmbedBuilder, type Client } from "discord.js";
import { getGuildState, updateGuildState } from "../data/store.js";
import { launchpointList } from "../integrations/launchpoint.js";

type LaunchpointPost = {
  id?: string;
  title?: string;
  url?: string;
  platform?: string;
  contractorName?: string;
  creatorInfo?: { name?: string };
  crossPostGroupId?: string;
  status?: string;
  uploadedAt?: number;
  views?: number;
  likes?: number;
};

export function launchpointPostKey(post: Pick<LaunchpointPost, "id" | "crossPostGroupId">): string | null {
  return post.crossPostGroupId || post.id || null;
}

export async function syncLaunchpointApprovedContent(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find((candidate) => candidate.name === "approved-content");
    if (!channel || !channel.isTextBased() || channel.isDMBased()) continue;
    let posts: LaunchpointPost[];
    try {
      posts = (await launchpointList<LaunchpointPost>("/posts")).filter((post) => Boolean(launchpointPostKey(post)));
    } catch (error) {
      console.error(`Launchpoint content sync failed for ${guild.id}:`, error);
      continue;
    }
    const state = await getGuildState(guild.id);
    const seen = new Set(state.launchpointSeenPostIds);
    // Bootstrap silently so the first sync does not flood the channel with historical posts.
    if (!state.launchpointSeenPostIds.length) {
      await updateGuildState(guild.id, (current) => {
        current.launchpointSeenPostIds = posts.flatMap((post) => launchpointPostKey(post) ?? []).slice(0, 500);
      });
      continue;
    }
    const fresh = posts.filter((post) => {
      const key = launchpointPostKey(post);
      return Boolean(key && !seen.has(key));
    });
    if (!fresh.length) continue;
    const delivered: string[] = [];
    for (const post of fresh.reverse()) {
      const creator = post.contractorName || post.creatorInfo?.name || "Creator";
      const normalizedStatus = post.status?.toLowerCase();
      const title = normalizedStatus === "approved" ? "✅ Content approved in Launchpoint" : "New content tracked in Launchpoint";
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle(title)
        .setDescription(post.title || "New creator content is available.")
        .addFields(
          { name: "Creator", value: creator, inline: true },
          { name: "Platform", value: post.platform || "Unknown", inline: true },
          ...(typeof post.views === "number" || typeof post.likes === "number" ? [{ name: "Performance", value: `${post.views ?? 0} views · ${post.likes ?? 0} likes`, inline: true }] : []),
        )
        .setFooter({ text: `Launchpoint · ${post.status || "tracked content"}` })
        .setTimestamp(post.uploadedAt ? new Date(post.uploadedAt) : new Date());
      if (post.url) embed.setURL(post.url);
      try {
        await channel.send({ embeds: [embed] });
        const key = launchpointPostKey(post);
        if (key) delivered.push(key);
      } catch (error) {
        console.error(`Could not post Launchpoint content in ${guild.id}:`, error);
      }
    }
    if (delivered.length) await updateGuildState(guild.id, (current) => {
      current.launchpointSeenPostIds = [...new Set([...current.launchpointSeenPostIds, ...delivered])].slice(-500);
    });
  }
}
