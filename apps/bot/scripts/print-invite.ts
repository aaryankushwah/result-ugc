import { OAuth2Scopes, PermissionFlagsBits, PermissionsBitField } from "discord.js";
import { loadEnv } from "../src/config/env.js";

const env = loadEnv();
const permissions = new PermissionsBitField([
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.ManageThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.SendMessagesInThreads,
]);

const query = new URLSearchParams({
  client_id: env.clientId,
  scope: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands].join(" "),
  permissions: permissions.bitfield.toString(),
});

console.log(`https://discord.com/oauth2/authorize?${query.toString()}`);
