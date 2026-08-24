export const signingProviders = ["launchpoint", "sideshift", "other"] as const;
export type SigningProvider = (typeof signingProviders)[number];

export const providerSyncModes = ["api", "manual"] as const;
export type ProviderSyncMode = (typeof providerSyncModes)[number];

export const relationshipStates = [
  "unlinked",
  "pending",
  "signed_upcoming",
  "signed_active",
  "expiring",
  "inactive",
  "sync_issue",
] as const;
export type RelationshipState = (typeof relationshipStates)[number];

export const creatorLifecycles = ["request", "active", "watch", "offboarded"] as const;
export type CreatorLifecycle = (typeof creatorLifecycles)[number];

export const trackingStates = ["healthy", "stale", "failed", "pending", "untracked"] as const;
export type TrackingState = (typeof trackingStates)[number];

export const accountPerformanceHealthStates = ["healthy", "warming", "at_risk", "inactive", "unknown"] as const;
export type AccountPerformanceHealthState = (typeof accountPerformanceHealthStates)[number];

export const discordStates = ["connected", "missing_access", "applicant", "left", "unknown"] as const;
export type DiscordState = (typeof discordStates)[number];

export const operationStates = ["queued", "running", "succeeded", "failed"] as const;
export type OperationState = (typeof operationStates)[number];

export const discordOperationTypes = [
  "approve_applicant",
  "reject_applicant",
  "restore_access",
  "open_private_channel",
  "offboard_creator",
  "reconcile_creator",
] as const;
export type DiscordOperationType = (typeof discordOperationTypes)[number];

export type ProviderCreator = {
  externalId: string;
  displayName: string;
  email?: string | null;
  username?: string | null;
  sourceUrl?: string | null;
};

export type ProviderRelationship = {
  externalId: string;
  provider: SigningProvider;
  program?: string | null;
  state: RelationshipState;
  startsAt?: string | null;
  endsAt?: string | null;
  sourceUrl?: string | null;
  lastSyncedAt?: string | null;
};

export type ProviderProgram = { id: string; name: string; status?: string | null };
export type ProviderActivity = {
  id: string;
  type: string;
  description: string;
  occurredAt: string;
};

export interface SigningProviderAdapter {
  readonly provider: SigningProvider;
  readonly syncMode: ProviderSyncMode;
  searchCreators(query: string): Promise<ProviderCreator[]>;
  getCreator(externalId: string): Promise<ProviderCreator | null>;
  getRelationships(externalId: string): Promise<ProviderRelationship[]>;
  getPrograms(): Promise<ProviderProgram[]>;
  getRecentActivity(since?: Date): Promise<ProviderActivity[]>;
  getDeepLink(externalId: string): string | null;
}

export type Freshness = {
  source: "result" | "discord" | "launchpoint" | "viral" | "sideshift";
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  state: "fresh" | "stale" | "failed" | "not_configured";
  message?: string | null;
};

export function deriveTrackingState(input: {
  loadAt?: string | null;
  lastErrorAt?: string | null;
  now?: Date;
  staleAfterMinutes?: number;
}): TrackingState {
  if (input.lastErrorAt && (!input.loadAt || input.lastErrorAt > input.loadAt)) return "failed";
  if (!input.loadAt) return "pending";
  const now = input.now ?? new Date();
  const staleAfter = (input.staleAfterMinutes ?? 45) * 60_000;
  return now.getTime() - new Date(input.loadAt).getTime() > staleAfter ? "stale" : "healthy";
}

export function aggregateTrackingState(states: readonly TrackingState[]): TrackingState {
  if (!states.length || states.every((state) => state === "untracked")) return "untracked";
  if (states.includes("failed")) return "failed";
  if (states.includes("stale")) return "stale";
  if (states.includes("pending")) return "pending";
  return "healthy";
}

type AccountPostActivityDay = { date: string; postedVideos: number };
type AccountWeeklyViewStat = { weekStart: string; avgViews: number | null; p50Views: number | null };

export function deriveAccountPerformanceHealth(input: {
  totalVideosPublished?: number | null;
  p50Views?: number | null;
  postActivity?: AccountPostActivityDay[] | null;
  weeklyViewStats?: AccountWeeklyViewStat[] | null;
  daysSinceLastPost?: number | null;
  now?: Date;
}): {
  state: AccountPerformanceHealthState;
  reason: string;
  recentPosts: number;
  recentMedianViews: number | null;
  baselineMedianViews: number | null;
} {
  const now = input.now ?? new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const recentStart = today - 6 * 86_400_000;
  const recentPosts = (input.postActivity ?? []).reduce((total, day) => {
    const time = new Date(`${day.date}T00:00:00Z`).getTime();
    return time >= recentStart && time <= today ? total + day.postedVideos : total;
  }, 0);
  const completedWeeks = (input.weeklyViewStats ?? [])
    .filter((week) => week.p50Views !== null && new Date(`${week.weekStart}T00:00:00Z`).getTime() + 7 * 86_400_000 <= today)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart));
  const recentMedianViews = completedWeeks.at(-1)?.p50Views ?? null;
  const baselineMedianViews = input.p50Views ?? null;
  const published = input.totalVideosPublished ?? 0;
  const daysSinceLastPost = input.daysSinceLastPost ?? null;

  if (!published) return { state: "warming", reason: "warm-up not started — no tracked posts", recentPosts, recentMedianViews, baselineMedianViews };
  if (daysSinceLastPost !== null && daysSinceLastPost > 7) return { state: "inactive", reason: `posting paused — last post ${daysSinceLastPost} days ago`, recentPosts, recentMedianViews, baselineMedianViews };
  if (published < 3 || baselineMedianViews === null) return { state: "warming", reason: `warm-up in progress — ${published} tracked ${published === 1 ? "post" : "posts"}`, recentPosts, recentMedianViews, baselineMedianViews };
  if (daysSinceLastPost !== null && daysSinceLastPost > 3) return { state: "at_risk", reason: `posting cadence slipping — no post for ${daysSinceLastPost} days`, recentPosts, recentMedianViews, baselineMedianViews };
  if (recentPosts < 3) return { state: "warming", reason: `warm-up in progress — ${recentPosts} ${recentPosts === 1 ? "post" : "posts"} in the last 7 days`, recentPosts, recentMedianViews, baselineMedianViews };
  if (recentMedianViews !== null && baselineMedianViews > 0 && recentMedianViews / baselineMedianViews < 0.55) {
    return { state: "at_risk", reason: `recent median views are ${Math.round((recentMedianViews / baselineMedianViews) * 100)}% of baseline`, recentPosts, recentMedianViews, baselineMedianViews };
  }
  if (recentMedianViews === null) return { state: "warming", reason: "building a completed-week performance baseline", recentPosts, recentMedianViews, baselineMedianViews };
  return { state: "healthy", reason: "recent videos performing", recentPosts, recentMedianViews, baselineMedianViews };
}

export function aggregateAccountPerformanceHealth(states: readonly AccountPerformanceHealthState[]): AccountPerformanceHealthState {
  if (!states.length || states.every((state) => state === "unknown")) return "unknown";
  if (states.includes("inactive")) return "inactive";
  if (states.includes("at_risk")) return "at_risk";
  if (states.includes("warming")) return "warming";
  return "healthy";
}

export function deriveRelationshipState(input: {
  startsAt?: Date | null;
  endsAt?: Date | null;
  active?: boolean | null;
  syncError?: boolean;
  now?: Date;
}): RelationshipState {
  if (input.syncError) return "sync_issue";
  if (input.active === false) return "inactive";
  const now = input.now ?? new Date();
  if (input.startsAt && input.startsAt > now) return "signed_upcoming";
  if (input.endsAt) {
    if (input.endsAt < now) return "inactive";
    if (input.endsAt.getTime() - now.getTime() <= 30 * 86_400_000) return "expiring";
  }
  if (input.active || input.startsAt || input.endsAt) return "signed_active";
  return "pending";
}
