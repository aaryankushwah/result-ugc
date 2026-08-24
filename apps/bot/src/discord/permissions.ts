import {
  PermissionFlagsBits,
  OverwriteType,
  type Guild,
  type OverwriteResolvable,
  type PermissionResolvable,
  type Role,
} from "discord.js";
import type { ChannelAccess, RoleKey } from "../config/blueprint.js";

export type RoleMap = Map<RoleKey, Role>;

const writerPermissions: PermissionResolvable[] = [
  PermissionFlagsBits.ViewChannel,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.SendMessagesInThreads,
  PermissionFlagsBits.CreatePublicThreads,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.Speak,
];

const staffByAccess: Record<Exclude<ChannelAccess, "everyone" | "member" | "creator">, RoleKey[]> = {
  team: ["admin", "manager", "moderator"],
};

const staffWriters: RoleKey[] = ["admin", "manager", "moderator"];

function addRoles(
  overwrites: OverwriteResolvable[],
  roleMap: RoleMap,
  keys: RoleKey[],
  readOnly: boolean,
): void {
  for (const key of keys) {
    const role = roleMap.get(key);
    if (role) overwrites.push(allow(role.id, readOnly));
  }
}

function allow(id: string, readOnly = false, type: OverwriteType = OverwriteType.Role): OverwriteResolvable {
  return {
    id,
    type,
    allow: readOnly
      ? [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.Connect]
      : writerPermissions,
    ...(readOnly
      ? {
          deny: [
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.SendMessagesInThreads,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.Speak,
          ],
        }
      : {}),
  };
}

export function channelOverwrites(
  guild: Guild,
  roleMap: RoleMap,
  access: ChannelAccess,
  readOnly: boolean,
): OverwriteResolvable[] {
  const botId = guild.members.me?.id;
  const overwrites: OverwriteResolvable[] = [];

  if (access === "everyone") {
    overwrites.push(allow(guild.roles.everyone.id, readOnly, OverwriteType.Role));
    if (readOnly) addRoles(overwrites, roleMap, ["admin", "manager"], false);
  } else {
    overwrites.push({ id: guild.roles.everyone.id, type: OverwriteType.Role, deny: [PermissionFlagsBits.ViewChannel] });

    if (access === "member") {
      addRoles(overwrites, roleMap, ["member", "creator"], readOnly);
      addRoles(overwrites, roleMap, staffWriters, false);
    } else if (access === "creator") {
      addRoles(overwrites, roleMap, ["creator"], readOnly);
      addRoles(overwrites, roleMap, staffWriters, false);
    } else {
      addRoles(overwrites, roleMap, staffByAccess[access], readOnly);
    }
  }

  if (botId) {
    overwrites.push({
      id: botId,
      type: OverwriteType.Member,
      allow: [
        ...writerPermissions,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ManageThreads,
      ],
    });
  }

  return overwrites;
}
