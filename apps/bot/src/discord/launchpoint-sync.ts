import { Colors, EmbedBuilder, type Client } from "discord.js";
import { getGuildState, updateGuildState } from "../data/store.js";
import { launchpointGet } from "../integrations/launchpoint.js";

type LaunchpointPost = {
  id?: string;
  title?: string;
  url?: string;
  platform?: string;
  contractorName?: string;
  creatorInfo?: { name?: string };
  uploadedAt?: number;
  views?: number;
  likes?: number;
};

type LaunchpointPosts = { data?: LaunchpointPost[] };

export async function syncLaunchpointApprovedContent(client: Client): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find((candidate) => candidate.name === "approved-content");
    if (!channel || !channel.isTextBased() || channel.isDMBased()) continue;
    let result: LaunchpointPosts;
    try {
      result = await launchpointGet<LaunchpointPosts>("/posts", { limit: "100" });
    } catch (error) {
      console.error(`Launchpoint content sync failed for ${guild.id}:`, error);
      continue;
    }
    const posts = (result.data ?? []).filter((post) => typeof post.id === "string");
    const state = await getGuildState(guild.id);
    const seen = new Set(state.launchpointSeenPostIds);
    // Bootstrap silently so the first sync does not flood the channel with historical posts.
    if (!state.launchpointSeenPostIds.length) {
      await updateGuildState(guild.id, (current) => {
        current.launchpointSeenPostIds = posts.map((post) => post.id!).slice(0, 500);
      });
      continue;
    }
    const fresh = posts.filter((post) => !seen.has(post.id!));
    if (!fresh.length) continue;
    await updateGuildState(guild.id, (current) => {
      current.launchpointSeenPostIds = [...new Set([...current.launchpointSeenPostIds, ...fresh.map((post) => post.id!)])].slice(-500);
    });
    for (const post of fresh.reverse()) {
      const creator = post.contractorName || post.creatorInfo?.name || "Creator";
      const embed = new EmbedBuilder()
        .setColor(Colors.Green)
        .setTitle("✅ Content approved in Launchpoint")
        .setDescription(post.title || "New approved creator content is ready.")
        .addFields(
          { name: "Creator", value: creator, inline: true },
          { name: "Platform", value: post.platform || "Unknown", inline: true },
          ...(typeof post.views === "number" || typeof post.likes === "number" ? [{ name: "Performance", value: `${post.views ?? 0} views · ${post.likes ?? 0} likes`, inline: true }] : []),
        )
        .setFooter({ text: "Launchpoint · tracked content" })
        .setTimestamp(post.uploadedAt ? new Date(post.uploadedAt) : new Date());
      if (post.url) embed.setURL(post.url);
      await channel.send({ embeds: [embed] }).catch((error: unknown) => console.error(`Could not post Launchpoint content in ${guild.id}:`, error));
    }
  }
}
