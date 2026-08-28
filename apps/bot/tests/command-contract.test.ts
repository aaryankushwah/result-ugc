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
      "warmup",
      "warmup-details",
      "help",
      "scripts",
      "setup",
    ]);
  });

  it("registers staff-only warmup commands with an optional bounded duration", () => {
    const warmup = commandData.find((command) => command.name === "warmup");
    const details = commandData.find((command) => command.name === "warmup-details");
    expect(warmup?.default_member_permissions).toBeDefined();
    expect(details?.default_member_permissions).toBeDefined();
    expect(warmup?.options).toEqual([
      expect.objectContaining({ name: "days", required: false, min_value: 1, max_value: 90 }),
    ]);
  });

  it("keeps creator-facing script lookup available without staff permissions", () => {
    const scripts = commandData.find((command) => command.name === "scripts");
    expect(scripts?.default_member_permissions).toBeUndefined();
    expect(scripts?.dm_permission).toBe(false);
  });
});
