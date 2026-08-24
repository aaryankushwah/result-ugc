import { PermissionFlagsBits } from "discord.js";
import { describe, expect, it } from "vitest";
import { blueprintChannels, categories, roles } from "../src/config/blueprint.js";
import { commandData } from "../src/discord/commands.js";

describe("UGC server blueprint", () => {
  it("uses unique role keys and names", () => {
    expect(new Set(roles.map((role) => role.key)).size).toBe(roles.length);
    expect(new Set(roles.map((role) => role.name)).size).toBe(roles.length);
  });

  it("uses unique channel keys", () => {
    expect(new Set(blueprintChannels.map((channel) => channel.key)).size).toBe(blueprintChannels.length);
  });

  it("keeps only the compact server channels", () => {
    const keys = new Set(blueprintChannels.map((channel) => channel.key));
    for (const key of [
      "verify",
      "announcements",
      "faq",
      "resources",
      "general",
      "wins",
      "accounts",
      "approved-content",
      "onboarding-alerts",
    ]) {
      expect(keys.has(key), `${key} must exist`).toBe(true);
    }
    expect(blueprintChannels).toHaveLength(9);
    expect(categories.map((category) => category.name)).toEqual(["START HERE", "UGC", "TEAM", "CREATORS"]);
  });

  it("keeps sensitive operations private", () => {
    const sensitive = ["approved-content", "onboarding-alerts"];
    for (const name of sensitive) {
      const channel = blueprintChannels.find((candidate) => candidate.name === name);
      expect(channel, `${name} must exist`).toBeDefined();
      expect(channel?.access).toBe("team");
    }
  });

  it("uses the compact creator approval roles", () => {
    expect(roles.map((role) => role.name)).toEqual([
      "Admin",
      "UGC Manager",
      "Moderator",
      "Verified Creator",
      "Member",
      "Applicant",
    ]);
    expect(roles.find((role) => role.name === "Admin")?.permissions).toEqual([
      PermissionFlagsBits.Administrator,
    ]);
  });

  it("keeps the UGC command palette free of editing and FOMO workflows", () => {
    const names = commandData.map((command) => command.name);
    expect(names).toEqual([
      "add-creator",
      "delete-creator",
      "creator-review",
      "creator-assign",
      "issue-link",
      "delete-link",
      "launchpoint",
      "group-call",
      "group-call-results",
      "group-call-reset",
      "health",
      "creator-progress",
      "help",
      "scripts",
      "setup",
    ]);
    expect(names.some((name) => name.startsWith("edit") || name.startsWith("fomo"))).toBe(false);
  });
});
