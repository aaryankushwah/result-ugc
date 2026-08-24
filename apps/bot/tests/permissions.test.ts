import { PermissionFlagsBits, type Guild, type Role } from "discord.js";
import { describe, expect, it } from "vitest";
import type { RoleKey } from "../src/config/blueprint.js";
import { channelOverwrites, type RoleMap } from "../src/discord/permissions.js";

function fakeRoles(): RoleMap {
  const map: RoleMap = new Map();
  for (const key of ["admin", "manager", "moderator", "creator", "member", "applicant"] as RoleKey[]) {
    map.set(key, { id: key } as Role);
  }
  return map;
}

const guild = {
  roles: { everyone: { id: "everyone" } },
  members: { me: { id: "bot" } },
} as unknown as Guild;

describe("channel permission generation", () => {
  it("keeps public information channels read-only while staff and the bot can post", () => {
    const overwrites = channelOverwrites(guild, fakeRoles(), "everyone", true) as Array<{
      id: string;
      allow?: bigint[];
      deny?: bigint[];
    }>;

    expect(overwrites.find((entry) => entry.id === "everyone")?.deny).toContain(PermissionFlagsBits.SendMessages);
    expect(overwrites.find((entry) => entry.id === "manager")?.allow).toContain(PermissionFlagsBits.SendMessages);
    expect(overwrites.find((entry) => entry.id === "bot")?.allow).toContain(PermissionFlagsBits.ManageChannels);
  });

  it("hides team channels from everyone and creators", () => {
    const overwrites = channelOverwrites(guild, fakeRoles(), "team", false) as Array<{
      id: string;
      allow?: bigint[];
      deny?: bigint[];
    }>;

    expect(overwrites.find((entry) => entry.id === "everyone")?.deny).toContain(PermissionFlagsBits.ViewChannel);
    expect(overwrites.some((entry) => entry.id === "creator")).toBe(false);
    expect(overwrites.find((entry) => entry.id === "manager")?.allow).toContain(PermissionFlagsBits.ViewChannel);
  });
});
