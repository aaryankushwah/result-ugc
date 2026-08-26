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
  "send_script_assignment",
] as const;
export type DiscordOperationType = (typeof discordOperationTypes)[number];

/**
 * Operation types that change Discord identity, roles, or channel membership and
 * therefore require a guild reconciliation pass once they succeed. Notification-only
 * operations are deliberately excluded: they mutate no identity state.
 */
export const identityChangingDiscordOperationTypes = [
  "approve_applicant",
  "reject_applicant",
  "restore_access",
  "open_private_channel",
  "offboard_creator",
  "reconcile_creator",
] as const;

export function requiresGuildReconciliation(type: string): boolean {
  return (identityChangingDiscordOperationTypes as readonly string[]).includes(type);
}

export const transcriptStates = ["provided", "pending", "transcribing", "transcribed", "failed"] as const;
export type TranscriptState = (typeof transcriptStates)[number];

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

export type LaunchpointPostIdentity = {
  url?: string;
  platform?: string;
};

export type LaunchpointSocialIdentity = {
  creatorExternalId: string;
  platform: string;
  username: string;
  url: string;
};

/** Extracts the posting account encoded in a Launchpoint post URL. */
export function launchpointSocialIdentityFromPost(
  post: LaunchpointPostIdentity,
  creatorExternalId: string,
): LaunchpointSocialIdentity | null {
  if (!post.url) return null;
  try {
    const url = new URL(post.url);
    const platform = (post.platform ?? (
      url.hostname.includes("instagram") ? "instagram"
        : url.hostname.includes("tiktok") ? "tiktok"
          : url.hostname.includes("youtube") || url.hostname.includes("youtu.be") ? "youtube"
            : ""
    )).toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let username: string | null = null;
    if (platform === "instagram" && parts[0] && !["p", "reel", "reels", "tv"].includes(parts[0].toLowerCase())) username = parts[0];
    if ((platform === "tiktok" || platform === "youtube") && parts[0]?.startsWith("@")) username = parts[0].slice(1);
    return username ? { creatorExternalId, platform, username: username.replace(/^@/, ""), url: post.url } : null;
  } catch {
    return null;
  }
}

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
  source: "result" | "discord" | "launchpoint" | "viral" | "sideshift" | "dub";
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

export type AccountHealthVideo = {
  publishedAt?: string | Date | null;
  views?: number | null;
  /** false once a manager has marked the post as warm-up / unpaid content. */
  included: boolean;
};

/**
 * Creators post on fresh accounts, and the first posts are warm-up content whose
 * views and engagement must not count. Warm-up is therefore decided from the
 * posts a manager has actually kept — an account is "warming" until it has
 * `warmupMinimumTrackedPosts` counted posts — and never from the account's raw
 * platform totals, which still contain the warm-up posts. Warm-up is a one-way
 * gate: once an account is warmed up, a light posting week reads as a cadence
 * problem (at_risk / inactive), never as a return to warm-up.
 */
export const warmupMinimumTrackedPosts = 3;
/** A post needs this long to accumulate views before it can move a median. */
const baselineMaturityDays = 7;
/** How far back a post still counts as "recent performance". */
const recentPerformanceDays = 21;
/** Recent median this far below baseline means the account is slipping. */
const atRiskViewRatio = 0.55;

function medianOf(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function deriveAccountPerformanceHealth(input: {
  videos?: readonly AccountHealthVideo[] | null;
  now?: Date;
}): {
  state: AccountPerformanceHealthState;
  reason: string;
  warmedUp: boolean;
  trackedPosts: number;
  warmupPosts: number;
  recentPosts: number;
  daysSinceLastPost: number | null;
  recentMedianViews: number | null;
  baselineMedianViews: number | null;
} {
  const now = input.now ?? new Date();
  const nowTime = now.getTime();
  const all = input.videos ?? [];
  // Excluded posts can reach us without a publish date; they still count as warm-up.
  const warmupPosts = all.filter((video) => !video.included).length;
  const tracked = all.filter((video) => video.included).map((video) => ({
    views: video.views ?? 0,
    time: video.publishedAt ? new Date(video.publishedAt).getTime() : Number.NaN,
  })).filter((video) => !Number.isNaN(video.time));
  const trackedPosts = tracked.length;

  const latestPostTime = tracked.reduce((latest, video) => Math.max(latest, video.time), 0);
  const daysSinceLastPost = latestPostTime ? Math.floor((nowTime - latestPostTime) / 86_400_000) : null;
  const recentPosts = tracked.filter((video) => nowTime - video.time <= 7 * 86_400_000).length;
  const mature = tracked.filter((video) => nowTime - video.time >= baselineMaturityDays * 86_400_000);
  const baselineMedianViews = mature.length >= warmupMinimumTrackedPosts ? medianOf(mature.map((video) => video.views)) : null;
  const recentMedianViews = medianOf(mature.filter((video) => nowTime - video.time <= recentPerformanceDays * 86_400_000).map((video) => video.views));
  const warmedUp = trackedPosts >= warmupMinimumTrackedPosts;
  const base = { warmedUp, trackedPosts, warmupPosts, recentPosts, daysSinceLastPost, recentMedianViews, baselineMedianViews };

  if (!all.length) return { state: "unknown", reason: "no posts synced for this account yet", ...base };
  if (!trackedPosts) {
    return { state: "warming", reason: `warm-up only — ${warmupPosts} ${warmupPosts === 1 ? "post" : "posts"} excluded, none counted yet`, ...base };
  }
  if (daysSinceLastPost !== null && daysSinceLastPost > 7) {
    return { state: "inactive", reason: `posting paused — last counted post ${daysSinceLastPost} days ago`, ...base };
  }
  if (!warmedUp) {
    return { state: "warming", reason: `warm-up in progress — ${trackedPosts} of ${warmupMinimumTrackedPosts} counted posts`, ...base };
  }
  if (daysSinceLastPost !== null && daysSinceLastPost > 3) {
    return { state: "at_risk", reason: `posting cadence slipping — no post for ${daysSinceLastPost} days`, ...base };
  }
  if (baselineMedianViews !== null && baselineMedianViews > 0 && recentMedianViews !== null && recentMedianViews / baselineMedianViews < atRiskViewRatio) {
    return { state: "at_risk", reason: `recent median views are ${Math.round((recentMedianViews / baselineMedianViews) * 100)}% of baseline`, ...base };
  }
  if (baselineMedianViews === null) {
    return { state: "healthy", reason: "posting on cadence — building a view baseline from counted posts", ...base };
  }
  return { state: "healthy", reason: "counted posts performing against baseline", ...base };
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
