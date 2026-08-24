import { Client, Events, GatewayIntentBits } from "discord.js";
import { loadEnv } from "./config/env.js";
import { handleInteraction, launchpointCreatorDirectory } from "./discord/interactions.js";
import { runReminderSweep } from "./discord/reminders.js";
import { syncLaunchpointApprovedContent } from "./discord/launchpoint-sync.js";
import { syncLaunchpointRelationships } from "./discord/provider-sync.js";
import { startViralSnapshotSchedule } from "./integrations/viral-snapshot.js";

const env = loadEnv();
import { processDiscordOperationQueue, reconcileGuild, reconcileMember } from "./discord/platform-sync.js";

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}. Serving ${readyClient.guilds.cache.size} server(s).`);
  void runReminderSweep(readyClient).catch((error) => console.error("Reminder sweep failed", error));
  void syncLaunchpointApprovedContent(readyClient).catch((error) => console.error("Launchpoint content sync failed", error));
  void launchpointCreatorDirectory().catch((error) => console.error("Launchpoint creator directory preload failed", error));
  void syncLaunchpointRelationships(readyClient).catch((error) => console.error("Launchpoint relationship sync failed", error));
  startViralSnapshotSchedule((error) => console.error("Viral snapshot sync failed", error));
  for (const guild of readyClient.guilds.cache.values()) {
    void reconcileGuild(guild).catch((error) => console.error(`Discord reconciliation failed for ${guild.id}`, error));
  }
  setInterval(() => {
    void runReminderSweep(readyClient).catch((error) => console.error("Reminder sweep failed", error));
  }, 60 * 60 * 1_000).unref();
  setInterval(() => {
    void syncLaunchpointApprovedContent(readyClient).catch((error) => console.error("Launchpoint content sync failed", error));
    void syncLaunchpointRelationships(readyClient).catch((error) => console.error("Launchpoint relationship sync failed", error));
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
client.on(Events.GuildMemberRemove, (member) => { void reconcileGuild(member.guild).catch((error) => console.error("Member remove reconciliation failed", error)); });
client.on(Events.ChannelCreate, (channel) => { if (!channel.isDMBased()) void reconcileGuild(channel.guild).catch((error) => console.error("Channel create reconciliation failed", error)); });
client.on(Events.ChannelUpdate, (_oldChannel, channel) => { if (!channel.isDMBased()) void reconcileGuild(channel.guild).catch((error) => console.error("Channel update reconciliation failed", error)); });
client.on(Events.ChannelDelete, (channel) => { if (!channel.isDMBased()) void reconcileGuild(channel.guild).catch((error) => console.error("Channel delete reconciliation failed", error)); });

client.on(Events.Error, (error) => console.error("Discord client error", error));
process.on("unhandledRejection", (error) => console.error("Unhandled rejection", error));

await client.login(env.token);
