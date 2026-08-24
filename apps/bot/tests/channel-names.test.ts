import { describe, expect, it } from "vitest";
import {
  discordChannelNameMatches,
  normalizeDiscordChannelName,
} from "../src/discord/channel-names.js";

describe("Discord channel names", () => {
  it("recognizes emoji-prefixed live channels as blueprint channels", () => {
    expect(discordChannelNameMatches("✅・verify", "verify")).toBe(true);
    expect(discordChannelNameMatches("📣・announcements", "announcements")).toBe(true);
    expect(discordChannelNameMatches("🎬・resources", "resources")).toBe(true);
    expect(discordChannelNameMatches("🔑・accounts", "accounts")).toBe(true);
  });

  it("normalizes spacing and punctuation consistently", () => {
    expect(normalizeDiscordChannelName("💬 General Chat")).toBe("general-chat");
    expect(discordChannelNameMatches("💬 General Chat", "general-chat")).toBe(true);
  });

  it("does not confuse unrelated channels", () => {
    expect(discordChannelNameMatches("bot-tests", "general")).toBe(false);
  });
});
