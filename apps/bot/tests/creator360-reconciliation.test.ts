import { describe, expect, it } from "vitest";
import { creator360PromotionReason } from "@result/domain";
import { reconciledDiscordIdentity } from "../src/discord/platform-sync.js";

describe("Creator 360 reconciliation", () => {
  it("keeps the last Discord identity when a member leaves the guild", () => {
    const current = { username: "emily", displayName: "Emily Ip", avatarUrl: "https://example.com/emily.png" };
    expect(reconciledDiscordIdentity(current, null)).toEqual(current);
  });

  it("refreshes Discord identity fields while the member is present", () => {
    const current = { username: "old", displayName: "Old name", avatarUrl: null };
    const observed = { username: "new", displayName: "New name", avatarUrl: "https://example.com/new.png" };
    expect(reconciledDiscordIdentity(current, observed)).toEqual(observed);
  });

  it("promotes system requests backed by connected Discord or confirmed provider ownership", () => {
    expect(creator360PromotionReason({ lifecycle: "request", managerLifecycleOverridden: false, discordState: "connected", hasLaunchpointMapping: false, hasConfirmedAccount: false })).toBe("discord_connected");
    expect(creator360PromotionReason({ lifecycle: "request", managerLifecycleOverridden: false, discordState: null, hasLaunchpointMapping: true, hasConfirmedAccount: true })).toBe("provider_account_confirmed");
  });

  it("never overrides a manager lifecycle choice or downgrades an existing creator", () => {
    expect(creator360PromotionReason({ lifecycle: "request", managerLifecycleOverridden: true, discordState: "connected", hasLaunchpointMapping: true, hasConfirmedAccount: true })).toBeNull();
    expect(creator360PromotionReason({ lifecycle: "active", managerLifecycleOverridden: false, discordState: "connected", hasLaunchpointMapping: true, hasConfirmedAccount: true })).toBeNull();
    expect(creator360PromotionReason({ lifecycle: "watch", managerLifecycleOverridden: false, discordState: "connected", hasLaunchpointMapping: true, hasConfirmedAccount: true })).toBeNull();
  });
});
