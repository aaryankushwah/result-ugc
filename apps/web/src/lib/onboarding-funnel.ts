import type { PortalCreator } from "@/lib/portal-types";

/**
 * Onboarding is a gated funnel: a creator only reaches a stage once every
 * earlier gate is satisfied. Stages are derived from current snapshot state,
 * never from the stored `nextStep` column, which is written once at insert
 * time and goes stale.
 */
export const onboardingStages = ["identify", "access", "signing", "tracking", "live"] as const;
export type OnboardingStage = (typeof onboardingStages)[number];

const onboardingStageLabels: Record<OnboardingStage, string> = {
  identify: "Identify",
  access: "Discord access",
  signing: "Signing",
  tracking: "Tracking",
  live: "Live",
};

export type OnboardingEntry = {
  creator: PortalCreator;
  stage: OnboardingStage;
  /** Why this creator is sitting at this stage. */
  blocker: string;
  /** The concrete thing a manager does to move them on. */
  action: string;
};

export type OnboardingStageSummary = {
  stage: OnboardingStage;
  label: string;
  /** Creators who cleared every earlier gate and so reached this stage. */
  reached: number;
  /** Creators currently stuck here. `live` never has any. */
  waiting: number;
  /** Share of the funnel entry population that reached this stage, 0–1. */
  conversion: number;
};

function hasConfirmedAccount(creator: PortalCreator): boolean {
  return creator.accounts.some((account) => account.linkState === "confirmed");
}

function hasActiveSigning(creator: PortalCreator): boolean {
  return creator.relationships.some((relationship) => relationship.state === "signed_active" || relationship.state === "signed_upcoming");
}

function trackedAccountCount(creator: PortalCreator): number {
  return creator.accounts.filter((account) => account.linkState === "confirmed" && (account.trackingState === "healthy" || account.trackingState === "pending")).length;
}

function identifyBlocker(creator: PortalCreator): Pick<OnboardingEntry, "blocker" | "action"> {
  if (creator.source === "viral_candidate") return { blocker: "Matched to a tracked account by username only", action: "Match this account to its Result creator" };
  if (!creator.accounts.length) return { blocker: "No social account on file", action: "Add the creator's posting accounts" };
  return { blocker: `${creator.accounts.length} suggested account${creator.accounts.length === 1 ? "" : "s"}, none confirmed`, action: "Confirm which accounts this creator owns" };
}

function accessBlocker(creator: PortalCreator): Pick<OnboardingEntry, "blocker" | "action"> {
  switch (creator.discord.state) {
    case "applicant":
      return { blocker: "Applied in Discord, not approved", action: "Approve the Discord applicant" };
    case "missing_access":
      return { blocker: "In the guild without the creator role", action: "Restore Discord access" };
    case "left":
      return { blocker: "Left the Discord guild", action: "Re-invite or offboard" };
    default:
      return { blocker: "No Discord identity linked", action: "Link the Discord identity" };
  }
}

function signingBlocker(creator: PortalCreator): Pick<OnboardingEntry, "blocker" | "action"> {
  if (!creator.relationships.length) return { blocker: "No signing relationship on file", action: "Confirm signing in Launchpoint or record it manually" };
  const relationship = creator.relationships.find((candidate) => candidate.state === "sync_issue")
    ?? creator.relationships.find((candidate) => candidate.state === "pending")
    ?? creator.relationships[0]!;
  const blocker = {
    sync_issue: `${relationship.provider} relationship failed to sync`,
    pending: `${relationship.provider} contract pending`,
    expiring: `${relationship.provider} contract expiring`,
    inactive: `${relationship.provider} relationship inactive`,
    unlinked: `${relationship.provider} relationship unlinked`,
  }[relationship.state as "sync_issue" | "pending" | "expiring" | "inactive" | "unlinked"] ?? `${relationship.provider} relationship not active`;
  return { blocker, action: relationship.state === "sync_issue" ? "Re-sync the signing provider" : "Confirm the signing relationship" };
}

function trackingBlocker(creator: PortalCreator): Pick<OnboardingEntry, "blocker" | "action"> {
  const confirmed = creator.accounts.filter((account) => account.linkState === "confirmed");
  const failed = confirmed.filter((account) => account.trackingState === "failed");
  if (failed.length) return { blocker: `Tracking failed on ${failed.length} account${failed.length === 1 ? "" : "s"}`, action: "Retry tracking for the failing account" };
  const stale = confirmed.filter((account) => account.trackingState === "stale");
  if (stale.length) return { blocker: `Tracking stale on ${stale.length} account${stale.length === 1 ? "" : "s"}`, action: "Refresh the account snapshot" };
  return { blocker: "No confirmed account is being tracked", action: "Start tracking a confirmed account" };
}

/**
 * Resolve one creator's current onboarding stage. Offboarded creators are not
 * in the funnel and are excluded by `buildOnboardingFunnel`.
 */
export function resolveOnboardingEntry(creator: PortalCreator): OnboardingEntry {
  if (creator.source === "viral_candidate" || !hasConfirmedAccount(creator)) return { creator, stage: "identify", ...identifyBlocker(creator) };
  if (creator.discord.state !== "connected") return { creator, stage: "access", ...accessBlocker(creator) };
  if (!hasActiveSigning(creator)) return { creator, stage: "signing", ...signingBlocker(creator) };
  if (!trackedAccountCount(creator)) return { creator, stage: "tracking", ...trackingBlocker(creator) };
  return { creator, stage: "live", blocker: "Cleared every onboarding gate", action: "No action needed" };
}

const stageOrder = new Map<OnboardingStage, number>(onboardingStages.map((stage, index) => [stage, index]));

/**
 * Every creator still in the funnel, earliest stage first, then by name so the
 * order is stable across renders.
 */
export function buildOnboardingFunnel(creators: PortalCreator[]): OnboardingEntry[] {
  return creators
    .filter((creator) => creator.lifecycle !== "offboarded")
    .map(resolveOnboardingEntry)
    .sort((a, b) => stageOrder.get(a.stage)! - stageOrder.get(b.stage)! || a.creator.displayName.localeCompare(b.creator.displayName));
}

export function summarizeOnboardingFunnel(entries: OnboardingEntry[]): OnboardingStageSummary[] {
  return onboardingStages.map((stage, index) => {
    const reached = entries.filter((entry) => stageOrder.get(entry.stage)! >= index).length;
    return {
      stage,
      label: onboardingStageLabels[stage],
      reached,
      waiting: stage === "live" ? 0 : entries.filter((entry) => entry.stage === stage).length,
      conversion: entries.length ? reached / entries.length : 0,
    };
  });
}
