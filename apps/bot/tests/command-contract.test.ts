import { describe, expect, it } from "vitest";
import { commandData } from "../src/discord/commands.js";

describe("Discord command contract", () => {
  it("registers only the supported production commands", () => {
    expect(commandData.map((command) => command.name)).toEqual([
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
  });

  it("keeps creator-facing script lookup available without staff permissions", () => {
    const scripts = commandData.find((command) => command.name === "scripts");
    expect(scripts?.default_member_permissions).toBeUndefined();
    expect(scripts?.dm_permission).toBe(false);
  });
});
