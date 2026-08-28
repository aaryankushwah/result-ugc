import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { engagementTotals, totalInteractions } from "./engagement";
import { getLiveViralData } from "./viral";
import type { PortalCreator, PortalData, PortalVideo } from "./portal-types";
import { getDatabasePortalData } from "./portal-database";
import { PORTAL_DATA_CACHE_TAG } from "./portal-cache";
import { buildPerformance } from "./performance";

const getCachedDatabasePortalData = unstable_cache(
  getDatabasePortalData,
  ["result-portal-data-v2"],
  { revalidate: 30, tags: [PORTAL_DATA_CACHE_TAG] },
);

function candidateCreators(accounts: PortalData["accounts"], videos: PortalVideo[]): PortalCreator[] {
  const cutoff = Date.now() - 30 * 86_400_000;
  return accounts.map((account) => {
    const accountVideos = videos.filter((video) => video.accountId === account.id);
    const recentVideos = accountVideos.filter((video) => video.publishedAt && new Date(video.publishedAt).getTime() >= cutoff);
    const views30d = recentVideos.reduce((sum, video) => sum + (video.included ? video.views : 0), 0);
    const engagement = engagementTotals(recentVideos, { countAll: true });
    const interactions = totalInteractions(engagement);
    return {
      id: `viral-${account.id}`,
      displayName: account.displayName,
      email: null,
      lifecycle: "request",
      attentionState: "Needs creator confirmation",
      nextStep: "Match this account to its Result creator",
      managerName: null,
      warmup: null,
      discord: { state: "unknown", userId: null, username: null, displayName: null, avatarUrl: null, channelId: null, guildId: null },
      relationships: [],
      accounts: [{ ...account, creatorId: `viral-${account.id}` }],
      notes: [],
      posts30d: recentVideos.length,
      views30d,
      likes30d: engagement.likes,
      comments30d: engagement.comments,
      shares30d: engagement.shares,
      bookmarks30d: engagement.bookmarks,
      engagementRate: views30d > 0 ? interactions / views30d : 0,
      trackingState: account.trackingState,
      lastActivityAt: account.latestPostAt,
      source: "viral_candidate",
    } satisfies PortalCreator;
  });
}

export const getPortalData = cache(async (): Promise<PortalData> => {
  const attemptedAt = new Date().toISOString();
  try {
    const databaseData = await getCachedDatabasePortalData();
    if (databaseData) return databaseData;
    const { accounts, videos } = await getLiveViralData();
    const newestRefresh = accounts.map((account) => account.refreshedAt).filter(Boolean).sort().at(-1) ?? null;
    return {
      organization: { id: null, name: "Result", slug: "result" },
      creators: candidateCreators(accounts, videos),
      accounts,
      videos,
      activities: [],
      performance: buildPerformance(videos),
      attribution: { links: [], series: [] },
      freshness: [
        { source: "viral", lastSuccessAt: newestRefresh, lastAttemptAt: attemptedAt, state: "fresh", message: `${accounts.length} accounts read live` },
        { source: "discord", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured", message: "Database reconciliation pending" },
        { source: "launchpoint", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured", message: "Database synchronization pending" },
        { source: "sideshift", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured", message: "Manual verification only" },
        { source: "dub", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured", message: "Add DUB_API_KEY to provision creator links" },
      ],
      providerErrors: [],
      sourceMode: "live_provider",
    };
  } catch (error) {
    return {
      organization: { id: null, name: "Result", slug: "result" },
      creators: [], accounts: [], videos: [], activities: [], performance: buildPerformance([]),
      attribution: { links: [], series: [] },
      freshness: [
        { source: "viral", lastSuccessAt: null, lastAttemptAt: attemptedAt, state: "failed", message: error instanceof Error ? error.message : "Viral request failed" },
        { source: "discord", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured" },
        { source: "launchpoint", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured" },
        { source: "sideshift", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured" },
        { source: "dub", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured" },
      ],
      providerErrors: [error instanceof Error ? error.message : "Viral request failed"],
      sourceMode: "unconfigured",
    };
  }
});
