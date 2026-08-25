import { describe, expect, it } from "vitest";
import { reconciliationUserIds } from "../src/discord/platform-sync.js";

const shared = {
  seedUserIds: ["affected"],
  legacyUserIds: ["legacy"],
  channelUserIds: ["channel"],
  connectionUserIds: ["connection"],
  roleUserIds: ["creator-role", "applicant-role"],
};

describe("Discord reconciliation scope", () => {
  it("updates only the affected member for gateway events and queue operations", () => {
    expect([...reconciliationUserIds({ mode: "targeted", ...shared })]).toEqual(["affected"]);
  });

  it("includes every known identity for startup and scheduled sweeps", () => {
    expect([...reconciliationUserIds({ mode: "full", ...shared })]).toEqual([
      "affected", "legacy", "channel", "connection", "creator-role", "applicant-role",
    ]);
  });
});
