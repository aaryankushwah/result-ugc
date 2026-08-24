import { describe, expect, it } from "vitest";
import { accountAssignmentLabel, discordConnectionLabel } from "./assignment-state";

describe("assignment pending states", () => {
  it("keeps a slow account mutation visibly pending outside the dialog", () => {
    expect(accountAssignmentLabel({ pending: true, confirmed: false, suggested: false, assigned: false })).toBe("Saving…");
    expect(accountAssignmentLabel({ pending: false, confirmed: true, suggested: false, assigned: false })).toBe("Assigned");
  });

  it("distinguishes Discord submission from durable queue confirmation", () => {
    expect(discordConnectionLabel({ pending: true, queued: false })).toBe("Connecting…");
    expect(discordConnectionLabel({ pending: false, queued: true })).toBe("Connection queued");
    expect(discordConnectionLabel({ pending: false, queued: false, linked: true })).toBe("Change Discord member");
    expect(discordConnectionLabel({ pending: false, queued: false, linked: false })).toBe("Connect Discord");
  });
});
