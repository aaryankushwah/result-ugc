import type { CreatorLifecycle, DiscordState, Freshness, RelationshipState, SigningProvider, TrackingState } from "@result/domain";

export type PortalAccount = {
  id: string;
  creatorId: string | null;
  platform: string;
  platformAccountId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  posts: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  averageViews: number;
  engagementRate: number;
  latestPostAt: string | null;
  trackingState: TrackingState;
  refreshedAt: string | null;
  linkState: "suggested" | "confirmed" | "unlinked";
  error: string | null;
  sourceUrl: string | null;
};

export type PortalVideo = {
  id: string;
  accountId: string;
  creatorId: string | null;
  platform: string;
  platformAccountId: string;
  platformVideoId: string;
  accountUsername: string;
  caption: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  engagementRate: number;
  baselineMultiplier: number;
  included: boolean;
  trackingState: TrackingState;
  refreshedAt: string | null;
  error: string | null;
  sourceUrl: string | null;
};

export type PortalRelationship = {
  id: string;
  provider: SigningProvider;
  syncMode: "api" | "manual";
  externalId: string | null;
  program: string | null;
  state: RelationshipState;
  startsAt: string | null;
  endsAt: string | null;
  sourceUrl: string | null;
  lastSyncedAt: string | null;
  error: string | null;
};

export type PortalCreator = {
  id: string;
  displayName: string;
  email: string | null;
  lifecycle: CreatorLifecycle;
  attentionState: string | null;
  nextStep: string | null;
  managerName: string | null;
  discord: {
    state: DiscordState;
    userId: string | null;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    channelId: string | null;
    guildId: string | null;
  };
  relationships: PortalRelationship[];
  accounts: PortalAccount[];
  notes: Array<{ id: string; body: string; author: string | null; createdAt: string }>;
  posts30d: number;
  views30d: number;
  engagementRate: number;
  trackingState: TrackingState;
  lastActivityAt: string | null;
  source: "result" | "viral_candidate";
};

export type PortalActivity = {
  id: string;
  creatorId: string | null;
  creatorName: string | null;
  type: string;
  summary: string;
  actor: string | null;
  occurredAt: string;
};

export type PerformancePoint = {
  date: string;
  views: number;
  posts: number;
  activeAccounts: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  engagementRate: number;
};

export type PortalAttributionLink = {
  id: string;
  creatorId: string;
  creatorName: string;
  shortLink: string;
  destinationUrl: string;
  state: string;
  clicks: number;
  leads: number;
  conversions: number;
  sales: number;
  saleAmount: number;
  lastClickedAt: string | null;
  refreshedAt: string | null;
  error: string | null;
};

export type PortalAttributionPoint = {
  date: string;
  clicks: number;
  leads: number;
  conversions: number;
  sales: number;
  revenue: number;
};

export type PortalAttribution = {
  links: PortalAttributionLink[];
  series: PortalAttributionPoint[];
};

export type PortalData = {
  organization: { id: string | null; name: string; slug: string };
  creators: PortalCreator[];
  accounts: PortalAccount[];
  videos: PortalVideo[];
  activities: PortalActivity[];
  performance: PerformancePoint[];
  attribution: PortalAttribution;
  freshness: Freshness[];
  providerErrors: string[];
  sourceMode: "database" | "live_provider" | "unconfigured";
};
