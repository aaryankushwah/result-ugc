import { Client, GatewayIntentBits } from "discord.js";
import { loadEnv } from "../src/config/env.js";
import { setupGuild, setupSummary } from "../src/discord/setup.js";

const env = loadEnv();
if (!env.guildId) throw new Error("DISCORD_GUILD_ID is required to sync a server.");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
try {
  await client.login(env.token);
  const guild = await client.guilds.fetch(env.guildId);
  const result = await setupGuild(guild);
  console.log(setupSummary(result).replaceAll("**", ""));
} finally {
  client.destroy();
}
