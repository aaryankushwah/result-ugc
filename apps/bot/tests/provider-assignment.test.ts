import { describe, expect, it } from "vitest";
import { launchpointAssignmentAction } from "../src/discord/provider-sync.js";

describe("Launchpoint manager assignment", () => {
  it("creates, keeps, or moves the canonical mapping explicitly", () => {
    expect(launchpointAssignmentAction(null, "creator-a")).toBe("create");
    expect(launchpointAssignmentAction("creator-a", "creator-a")).toBe("keep");
    expect(launchpointAssignmentAction("creator-b", "creator-a")).toBe("move");
  });
});
