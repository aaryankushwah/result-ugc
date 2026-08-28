import { describe, expect, it } from "vitest";
import type { PortalCreator } from "./portal-types";
import { creatorMatchesFilters } from "./creator-filters";

function creator(overrides: Partial<PortalCreator> = {}): PortalCreator {
  return {
    id: "creator-1", displayName: "Jimi", email: null, lifecycle: "active", attentionState: null, nextStep: null, managerName: null,
    discord: { state: "connected", userId: "discord-1", username: "jimizhao", displayName: "Jimi", avatarUrl: null, channelId: null, guildId: null },
    relationships: [], accounts: [], notes: [], posts30d: 0, views30d: 0, likes30d: 0, comments30d: 0, shares30d: 0, bookmarks30d: 0,
    engagementRate: 0, trackingState: "healthy", warmup: null, lastActivityAt: null, source: "result", ...overrides,
  };
}

const base = { lifecycle: "active" as const, search: "", discord: null, provider: null, health: null };

describe("creatorMatchesFilters", () => {
  it("matches Discord usernames in search", () => expect(creatorMatchesFilters(creator(), { ...base, search: "jimizhao" })).toBe(true));
  it("shows missing Discord access", () => expect(creatorMatchesFilters(creator({ discord: { state: "left", userId: null, username: null, displayName: null, avatarUrl: null, channelId: null, guildId: null } }), { ...base, discord: "missing_access" })).toBe(true));
  it("shows creators without signing relationships", () => expect(creatorMatchesFilters(creator(), { ...base, provider: "unlinked" })).toBe(true));
  it("treats failed tracking as stale attention", () => expect(creatorMatchesFilters(creator({ trackingState: "failed" }), { ...base, health: "stale" })).toBe(true));
});
