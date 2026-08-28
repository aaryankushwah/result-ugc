import { describe, expect, it } from "vitest";
import { discordOperationTypes, requiresGuildReconciliation } from "@result/domain";

describe("discord operation types", () => {
  it("includes the script assignment type the portal enqueues", () => {
    // The portal has always enqueued this; the bot used to reject it as unsupported.
    expect(discordOperationTypes).toContain("send_script_assignment");
    expect(discordOperationTypes).toContain("send_warmup_reminder");
    expect(discordOperationTypes).toContain("send_warmup_complete");
  });

  it("reconciles the guild only for identity-changing operations", () => {
    for (const type of ["approve_applicant", "reject_applicant", "restore_access", "open_private_channel", "offboard_creator", "reconcile_creator"]) {
      expect(requiresGuildReconciliation(type), type).toBe(true);
    }
    expect(requiresGuildReconciliation("send_script_assignment")).toBe(false);
    expect(requiresGuildReconciliation("send_warmup_reminder")).toBe(false);
    expect(requiresGuildReconciliation("send_warmup_complete")).toBe(false);
    expect(requiresGuildReconciliation("something_unknown")).toBe(false);
  });
});
