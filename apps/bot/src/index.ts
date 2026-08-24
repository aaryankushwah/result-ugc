import { Client, Events, GatewayIntentBits } from "discord.js";
import { loadEnv } from "./config/env.js";
import { handleInteraction, launchpointCreatorDirectory } from "./discord/interactions.js";
import { runReminderSweep } from "./discord/reminders.js";
import { syncLaunchpointApprovedContent } from "./discord/launchpoint-sync.js";

const env = loadEnv();
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Ready as ${readyClient.user.tag}. Serving ${readyClient.guilds.cache.size} server(s).`);
  void runReminderSweep(readyClient).catch((error) => console.error("Reminder sweep failed", error));
  void syncLaunchpointApprovedContent(readyClient).catch((error) => console.error("Launchpoint content sync failed", error));
  void launchpointCreatorDirectory().catch((error) => console.error("Launchpoint creator directory preload failed", error));
  setInterval(() => {
    void runReminderSweep(readyClient).catch((error) => console.error("Reminder sweep failed", error));
  }, 60 * 60 * 1_000).unref();
  setInterval(() => {
    void syncLaunchpointApprovedContent(readyClient).catch((error) => console.error("Launchpoint content sync failed", error));
  }, 10 * 60 * 1_000).unref();
});

client.on(Events.InteractionCreate, handleInteraction);

client.on(Events.Error, (error) => console.error("Discord client error", error));
process.on("unhandledRejection", (error) => console.error("Unhandled rejection", error));

await client.login(env.token);
