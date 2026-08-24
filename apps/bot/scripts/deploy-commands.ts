import { REST, Routes } from "discord.js";
import { loadEnv } from "../src/config/env.js";
import { commandData } from "../src/discord/commands.js";

const env = loadEnv();
const rest = new REST({ version: "10" }).setToken(env.token);

if (env.guildId) {
  await rest.put(Routes.applicationGuildCommands(env.clientId, env.guildId), { body: commandData });
  console.log(`Deployed ${commandData.length} commands to test server ${env.guildId}.`);
} else {
  await rest.put(Routes.applicationCommands(env.clientId), { body: commandData });
  console.log(`Deployed ${commandData.length} global commands. Global propagation can take time.`);
}
