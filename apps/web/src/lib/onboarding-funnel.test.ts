import { describe, expect, it } from "vitest";
import { buildOnboardingFunnel, resolveOnboardingEntry, summarizeOnboardingFunnel } from "./onboarding-funnel";
import type { PortalAccount, PortalCreator, PortalRelationship } from "./portal-types";

function account(overrides: Partial<PortalAccount> = {}): PortalAccount {
  return {
    id: "account-1", creatorId: "creator-1", platform: "tiktok", platformAccountId: "1", username: "creator", displayName: "Creator",
    avatarUrl: null, followers: 0, following: 0, posts: 0, views: 0, likes: 0, comments: 0, shares: 0, bookmarks: 0,
    averageViews: 0, engagementRate: 0, latestPostAt: null, trackingState: "healthy", refreshedAt: null,
    linkState: "confirmed", error: null, sourceUrl: null, ...overrides,
  };
}

function relationship(overrides: Partial<PortalRelationship> = {}): PortalRelationship {
  return {
    id: "relationship-1", provider: "launchpoint", syncMode: "api", externalId: "lp-1", program: null,
    state: "signed_active", startsAt: null, endsAt: null, sourceUrl: null, lastSyncedAt: null, error: null, ...overrides,
  };
}

function creator(overrides: Partial<PortalCreator> = {}): PortalCreator {
  return {
    id: "creator-1", displayName: "Creator", email: null, lifecycle: "active", attentionState: null, nextStep: null, managerName: null,
    discord: { state: "connected", userId: "1", username: "creator", displayName: "Creator", avatarUrl: null, channelId: null, guildId: null },
    relationships: [relationship()], accounts: [account()], notes: [], posts30d: 0, views30d: 0, likes30d: 0, comments30d: 0, shares30d: 0, bookmarks30d: 0, engagementRate: 0,
    trackingState: "healthy", warmup: null, lastActivityAt: null, source: "result", ...overrides,
  };
}

describe("onboarding stage resolution", () => {
  it("holds an unmatched Viral candidate at identify", () => {
    const entry = resolveOnboardingEntry(creator({ source: "viral_candidate", accounts: [account({ linkState: "suggested" })] }));
    expect(entry.stage).toBe("identify");
    expect(entry.action).toBe("Match this account to its Result creator");
  });

  it("holds a creator whose accounts are only suggested at identify", () => {
    expect(resolveOnboardingEntry(creator({ accounts: [account({ linkState: "suggested" })] })).stage).toBe("identify");
  });

  it("reports the specific Discord blocker once identity is confirmed", () => {
    const applicant = resolveOnboardingEntry(creator({ discord: { ...creator().discord, state: "applicant" } }));
    expect(applicant).toMatchObject({ stage: "access", action: "Approve the Discord applicant" });
    expect(resolveOnboardingEntry(creator({ discord: { ...creator().discord, state: "missing_access" } })).action).toBe("Restore Discord access");
    expect(resolveOnboardingEntry(creator({ discord: { ...creator().discord, state: "left" } })).action).toBe("Re-invite or offboard");
  });

  it("does not let a signed relationship in a non-active state clear the signing gate", () => {
    expect(resolveOnboardingEntry(creator({ relationships: [] })).blocker).toBe("No signing relationship on file");
    expect(resolveOnboardingEntry(creator({ relationships: [relationship({ state: "pending" })] })).stage).toBe("signing");
    expect(resolveOnboardingEntry(creator({ relationships: [relationship({ state: "sync_issue" })] })).action).toBe("Re-sync the signing provider");
    expect(resolveOnboardingEntry(creator({ relationships: [relationship({ state: "signed_upcoming" })] })).stage).toBe("live");
  });

  it("separates failed tracking from stale tracking and from nothing tracked", () => {
    expect(resolveOnboardingEntry(creator({ accounts: [account({ trackingState: "failed" })] })).blocker).toBe("Tracking failed on 1 account");
    expect(resolveOnboardingEntry(creator({ accounts: [account({ trackingState: "stale" })] })).blocker).toBe("Tracking stale on 1 account");
    expect(resolveOnboardingEntry(creator({ accounts: [account({ trackingState: "untracked" })] })).blocker).toBe("No confirmed account is being tracked");
  });

  it("ignores tracking on accounts that are not confirmed to this creator", () => {
    const entry = resolveOnboardingEntry(creator({ accounts: [account(), account({ id: "account-2", linkState: "suggested", trackingState: "failed" })] }));
    expect(entry.stage).toBe("live");
  });

  it("clears every gate for a fully onboarded creator", () => {
    expect(resolveOnboardingEntry(creator()).stage).toBe("live");
  });

  it("resolves the earliest unmet gate when several are unmet", () => {
    const entry = resolveOnboardingEntry(creator({ discord: { ...creator().discord, state: "applicant" }, relationships: [], accounts: [account({ trackingState: "untracked" })] }));
    expect(entry.stage).toBe("access");
  });
});

describe("onboarding funnel", () => {
  it("excludes offboarded creators and orders by stage then name", () => {
    const entries = buildOnboardingFunnel([
      creator({ id: "live", displayName: "Zoe" }),
      creator({ id: "gone", displayName: "Gone", lifecycle: "offboarded", relationships: [] }),
      creator({ id: "signing", displayName: "Abe", relationships: [] }),
      creator({ id: "identify", displayName: "Bea", accounts: [account({ linkState: "suggested" })] }),
    ]);
    expect(entries.map((entry) => entry.creator.id)).toEqual(["identify", "signing", "live"]);
  });

  it("counts a stage as reached once every earlier gate is cleared", () => {
    const summary = summarizeOnboardingFunnel(buildOnboardingFunnel([
      creator({ id: "a", accounts: [account({ linkState: "suggested" })] }),
      creator({ id: "b", discord: { ...creator().discord, state: "applicant" } }),
      creator({ id: "c", relationships: [] }),
      creator({ id: "d", accounts: [account({ trackingState: "untracked" })] }),
      creator({ id: "e" }),
    ]));
    expect(summary.map((stage) => [stage.stage, stage.reached, stage.waiting])).toEqual([
      ["identify", 5, 1],
      ["access", 4, 1],
      ["signing", 3, 1],
      ["tracking", 2, 1],
      ["live", 1, 0],
    ]);
    expect(summary[0]!.conversion).toBe(1);
    expect(summary[4]!.conversion).toBeCloseTo(0.2);
  });

  it("reports an empty funnel without dividing by zero", () => {
    expect(summarizeOnboardingFunnel([]).every((stage) => stage.reached === 0 && stage.conversion === 0)).toBe(true);
  });
});
