import { Client, Events, GatewayIntentBits } from "discord.js";
import { loadEnv } from "./config/env.js";
import { handleInteraction } from "./discord/interactions.js";
import { runReminderSweep } from "./discord/reminders.js";
import { runWarmupReminderSweep } from "./discord/warmups.js";
import { syncLaunchpointApprovedContent } from "./discord/launchpoint-sync.js";
import { syncLaunchpointRelationships } from "./discord/provider-sync.js";
import { startDubAttributionSchedule } from "./discord/dub-sync.js";
import { startViralSnapshotSchedule } from "./integrations/viral-snapshot.js";
import { creatorIdFromChannelTopic } from "./discord/setup.js";

const env = loadEnv();
import { processDiscordOperationQueue, reconcileGuild, reconcileMember } from "./discord/platform-sync.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}. Serving ${readyClient.guilds.cache.size} server(s).`);
  void (async () => {
    // Establish the canonical Discord identities first. Provider mappings can
    // then attach to those records instead of racing startup and seeding duplicates.
    await Promise.all([...readyClient.guilds.cache.values()].map((guild) =>
      reconcileGuild(guild).catch((error) => console.error(`Discord reconciliation failed for ${guild.id}`, error))));
    await processDiscordOperationQueue(readyClient).catch((error) => console.error("Initial Discord operation queue failed", error));
    await Promise.allSettled([
      runReminderSweep(readyClient),
      runWarmupReminderSweep(readyClient),
    ]).then((results) => {
      const labels = ["Reminder sweep", "Warmup reminder sweep"];
      results.forEach((result, index) => { if (result.status === "rejected") console.error(`${labels[index]} failed`, result.reason); });
    });
    await syncLaunchpointRelationships(readyClient).catch((error) => console.error("Launchpoint relationship sync failed", error));
    await syncLaunchpointApprovedContent(readyClient).catch((error) => console.error("Launchpoint content sync failed", error));
    startViralSnapshotSchedule((error) => console.error("Viral snapshot sync failed", error));
    startDubAttributionSchedule((error) => console.error("Dub attribution sync failed", error));
  })().catch((error) => console.error("Bot startup synchronization failed", error));
  setInterval(() => {
    void Promise.all([
      runReminderSweep(readyClient),
      runWarmupReminderSweep(readyClient),
    ]).catch((error) => console.error("Reminder sweep failed", error));
  }, 60 * 60 * 1_000).unref();
  setInterval(() => {
    void (async () => {
      await syncLaunchpointRelationships(readyClient).catch((error) => console.error("Launchpoint relationship sync failed", error));
      await syncLaunchpointApprovedContent(readyClient).catch((error) => console.error("Launchpoint content sync failed", error));
    })();
  }, 10 * 60 * 1_000).unref();
  setInterval(() => {
    for (const guild of readyClient.guilds.cache.values()) void reconcileGuild(guild).catch((error) => console.error(`Discord reconciliation failed for ${guild.id}`, error));
  }, 10 * 60 * 1_000).unref();
  setInterval(() => {
    void processDiscordOperationQueue(readyClient).catch((error) => console.error("Discord operation queue failed", error));
  }, 5_000).unref();
});

client.on(Events.InteractionCreate, handleInteraction);
client.on(Events.GuildMemberAdd, (member) => { void reconcileMember(member).catch((error) => console.error("Member add reconciliation failed", error)); });
client.on(Events.GuildMemberUpdate, (_oldMember, member) => { void reconcileMember(member).catch((error) => console.error("Member update reconciliation failed", error)); });
client.on(Events.GuildMemberRemove, (member) => { void reconcileGuild(member.guild, [member.id], "targeted").catch((error) => console.error("Member remove reconciliation failed", error)); });

function reconcileCreatorChannel(channel: import("discord.js").GuildBasedChannel, label: string): void {
  if (channel.isDMBased() || !("topic" in channel)) return;
  const userId = creatorIdFromChannelTopic(channel.topic);
  if (!userId) return;
  void reconcileGuild(channel.guild, [userId], "targeted").catch((error) => console.error(`${label} reconciliation failed`, error));
}

client.on(Events.ChannelCreate, (channel) => reconcileCreatorChannel(channel, "Channel create"));
client.on(Events.ChannelUpdate, (oldChannel, channel) => {
  if (!oldChannel.isDMBased()) reconcileCreatorChannel(oldChannel, "Channel update");
  if (!channel.isDMBased()) reconcileCreatorChannel(channel, "Channel update");
});
client.on(Events.ChannelDelete, (channel) => { if (!channel.isDMBased()) reconcileCreatorChannel(channel, "Channel delete"); });

client.on(Events.Error, (error) => console.error("Discord client error", error));
process.on("unhandledRejection", (error) => console.error("Unhandled rejection", error));

await client.login(env.token);
