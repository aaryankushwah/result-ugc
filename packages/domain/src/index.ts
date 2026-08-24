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
