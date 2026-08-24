import "server-only";

import {
  activityEvents,
  attributionDailySnapshots,
  creatorAttributionLinks,
  creatorDiscord,
  creatorNotes,
  creators,
  getDatabase,
  internalUsers,
  organizations,
  signingRelationships,
  socialAccounts,
  syncRuns,
  videos as videoTable,
} from "@result/db";
import { desc, eq } from "drizzle-orm";
import type { PortalAccount, PortalActivity, PortalAttributionPoint, PortalCreator, PortalData, PortalRelationship, PortalVideo } from "./portal-types";
import { buildPerformance } from "./performance";

const VIRAL_STALE_AFTER_MS = 30 * 60 * 1_000;
const PROVIDER_STALE_AFTER_MS = 20 * 60 * 1_000;

function accountSourceUrl(platform: string, username: string): string | null {
  const handle = username.replace(/^@/, "");
  switch (platform.toLowerCase()) {
    case "instagram": return `https://www.instagram.com/${handle}/`;
    case "tiktok": return `https://www.tiktok.com/@${handle}`;
    case "youtube": return `https://www.youtube.com/@${handle}`;
    case "facebook": return `https://www.facebook.com/${handle}`;
    default: return null;
  }
}

function videoSourceUrl(platform: string, username: string, platformVideoId: string): string | null {
  switch (platform.toLowerCase()) {
    case "instagram": return `https://www.instagram.com/reel/${platformVideoId}/`;
    case "tiktok": return `https://www.tiktok.com/@${username.replace(/^@/, "")}/video/${platformVideoId}`;
    case "youtube": return `https://www.youtube.com/watch?v=${platformVideoId}`;
    case "facebook": return `https://www.facebook.com/watch/?v=${platformVideoId}`;
    default: return null;
  }
}

export async function getDatabasePortalData(): Promise<PortalData | null> {
  if (!process.env.DATABASE_URL) return null;
  const db = getDatabase();
  const organization = (await db.select().from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (!organization) return null;

  const [creatorRows, discordRows, relationshipRows, accountRows, videoRows, userRows, noteRows, activityRows, runRows, attributionLinkRows, attributionSnapshotRows] = await Promise.all([
    db.select().from(creators).where(eq(creators.organizationId, organization.id)),
    db.select().from(creatorDiscord).where(eq(creatorDiscord.organizationId, organization.id)),
    db.select().from(signingRelationships).where(eq(signingRelationships.organizationId, organization.id)),
    db.select().from(socialAccounts).where(eq(socialAccounts.organizationId, organization.id)),
    db.select().from(videoTable).where(eq(videoTable.organizationId, organization.id)),
    db.select().from(internalUsers).where(eq(internalUsers.organizationId, organization.id)),
    db.select().from(creatorNotes).where(eq(creatorNotes.organizationId, organization.id)).orderBy(desc(creatorNotes.createdAt)),
    db.select().from(activityEvents).where(eq(activityEvents.organizationId, organization.id)).orderBy(desc(activityEvents.occurredAt)).limit(250),
    db.select().from(syncRuns).where(eq(syncRuns.organizationId, organization.id)).orderBy(desc(syncRuns.startedAt)).limit(250),
    db.select().from(creatorAttributionLinks).where(eq(creatorAttributionLinks.organizationId, organization.id)),
    db.select().from(attributionDailySnapshots).where(eq(attributionDailySnapshots.organizationId, organization.id)).orderBy(attributionDailySnapshots.bucketAt),
  ]);

  const accounts: PortalAccount[] = accountRows.map((account) => {
    const resolvedCreatorId = account.creatorId ?? account.suggestedCreatorId ?? null;
    const username = account.username ?? "unknown";
    return {
      id: account.viralOrgAccountId,
      creatorId: resolvedCreatorId,
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      username,
      displayName: account.displayName ?? username,
      avatarUrl: account.avatarUrl,
      followers: account.followers,
      following: account.following,
      posts: account.posts,
      views: account.views,
      likes: account.likes,
      comments: account.comments,
      shares: account.shares,
      bookmarks: account.bookmarks,
      averageViews: account.averageViews ?? 0,
      engagementRate: account.engagementRate ?? 0,
      latestPostAt: account.latestPostAt?.toISOString() ?? null,
      trackingState: account.trackingState,
      refreshedAt: account.sourceRefreshedAt?.toISOString() ?? null,
      linkState: account.linkState,
      error: account.lastError,
      sourceUrl: accountSourceUrl(account.platform, username),
    };
  });

  const accountByDatabaseId = new Map(accountRows.map((account) => [account.id, account]));
  const portalAccountByDatabaseId = new Map(accountRows.map((account, index) => [account.id, accounts[index]!]));
  const videos: PortalVideo[] = videoRows.flatMap((video) => {
    const accountRow = accountByDatabaseId.get(video.accountId);
    const account = portalAccountByDatabaseId.get(video.accountId);
    if (!accountRow || !account) return [];
    return [{
      id: video.viralVideoId,
      accountId: account.id,
      creatorId: account.creatorId,
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      platformVideoId: video.platformVideoId,
      accountUsername: account.username,
      caption: video.caption ?? "Untitled video",
      thumbnailUrl: video.thumbnailUrl,
      durationSeconds: video.durationSeconds,
      publishedAt: video.publishedAt?.toISOString() ?? null,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      shares: video.shares,
      bookmarks: video.bookmarks,
      engagementRate: video.engagementRate ?? 0,
      baselineMultiplier: video.baselineMultiplier ?? 0,
      included: video.included,
      trackingState: video.trackingState,
      refreshedAt: video.sourceRefreshedAt?.toISOString() ?? null,
      error: video.lastError,
      sourceUrl: videoSourceUrl(account.platform, account.username, video.platformVideoId),
    }];
  });

  const creatorById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  const managerById = new Map(userRows.map((user) => [user.id, user.displayName]));
  const cutoff = Date.now() - 30 * 86_400_000;
  const resultCreators: PortalCreator[] = creatorRows.map((creator) => {
    const connection = discordRows.find((row) => row.creatorId === creator.id);
    const creatorAccounts = accounts.filter((account) => account.creatorId === creator.id);
    const confirmedAccountIds = new Set(creatorAccounts.filter((account) => account.linkState === "confirmed").map((account) => account.id));
    const recentVideos = videos.filter((video) => confirmedAccountIds.has(video.accountId) && video.publishedAt && new Date(video.publishedAt).getTime() >= cutoff);
    const views = recentVideos.reduce((sum, video) => sum + (video.included ? video.views : 0), 0);
    const interactions = recentVideos.reduce((sum, video) => sum + (video.included ? video.likes + video.comments + video.shares + video.bookmarks : 0), 0);
    const relationships: PortalRelationship[] = relationshipRows.filter((row) => row.creatorId === creator.id).map((row) => ({
      id: row.id,
      provider: row.provider,
      syncMode: row.syncMode,
      externalId: row.externalId,
      program: row.program,
      state: row.state,
      startsAt: row.startsAt?.toISOString() ?? null,
      endsAt: row.endsAt?.toISOString() ?? null,
      sourceUrl: row.sourceUrl,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
      error: row.lastError,
    }));
    const confirmedAccounts = creatorAccounts.filter((account) => account.linkState === "confirmed");
    const trackingState = confirmedAccounts.some((account) => account.trackingState === "failed") ? "failed"
      : confirmedAccounts.some((account) => account.trackingState === "stale") ? "stale"
        : confirmedAccounts.length ? "healthy" : "untracked";
    return {
      id: creator.id,
      displayName: creator.displayName,
      email: creator.email,
      lifecycle: creator.lifecycle,
      attentionState: creator.attentionState,
      nextStep: creator.nextStep,
      managerName: creator.managerUserId ? managerById.get(creator.managerUserId) ?? null : null,
      discord: {
        state: connection?.state ?? "unknown",
        userId: connection?.discordUserId ?? null,
        username: connection?.username ?? null,
        displayName: connection?.displayName ?? null,
        avatarUrl: connection?.avatarUrl ?? null,
        channelId: connection?.privateChannelId ?? null,
        guildId: connection?.guildId ?? organization.discordGuildId,
      },
      relationships,
      accounts: creatorAccounts,
      notes: noteRows.filter((note) => note.creatorId === creator.id).map((note) => ({ id: note.id, body: note.body, author: note.authorUserId ? managerById.get(note.authorUserId) ?? null : null, createdAt: note.createdAt.toISOString() })),
      posts30d: recentVideos.filter((video) => video.included).length,
      views30d: views,
      engagementRate: views ? interactions / views : 0,
      trackingState,
      lastActivityAt: creator.lastActivityAt?.toISOString() ?? null,
      source: "result",
    };
  });

  const assigned = new Set(accounts.filter((account) => account.creatorId).map((account) => account.id));
  const unmatched = accounts.filter((account) => !assigned.has(account.id)).map((account) => {
    const accountVideos = videos.filter((video) => video.accountId === account.id);
    const recentVideos = accountVideos.filter((video) => video.publishedAt && new Date(video.publishedAt).getTime() >= cutoff);
    const views30d = recentVideos.reduce((sum, video) => sum + (video.included ? video.views : 0), 0);
    const interactions = recentVideos.reduce((sum, video) => sum + (video.included ? video.likes + video.comments + video.shares + video.bookmarks : 0), 0);
    return {
      id: `viral-${account.id}`,
      displayName: account.displayName,
      email: null,
      lifecycle: "request" as const,
      attentionState: "Needs creator confirmation",
      nextStep: "Match this account to its Result creator",
      managerName: null,
      discord: { state: "unknown" as const, userId: null, username: null, displayName: null, avatarUrl: null, channelId: null, guildId: organization.discordGuildId },
      relationships: [],
      accounts: [{ ...account, creatorId: `viral-${account.id}` }],
      notes: [],
      posts30d: recentVideos.filter((video) => video.included).length,
      views30d,
      engagementRate: views30d ? interactions / views30d : 0,
      trackingState: account.trackingState,
      lastActivityAt: account.latestPostAt,
      source: "viral_candidate" as const,
    };
  });

  const activities: PortalActivity[] = activityRows.map((event) => ({
    id: event.id,
    creatorId: event.creatorId,
    creatorName: event.creatorId ? creatorById.get(event.creatorId)?.displayName ?? null : null,
    type: event.type,
    summary: event.summary,
    actor: event.actorUserId ? managerById.get(event.actorUserId) ?? null : event.actorDiscordUserId ? `Discord ${event.actorDiscordUserId}` : "System",
    occurredAt: event.occurredAt.toISOString(),
  }));

  const attributionLinks = attributionLinkRows.map((link) => ({
    id: link.id,
    creatorId: link.creatorId,
    creatorName: creatorById.get(link.creatorId)?.displayName ?? "Unknown creator",
    shortLink: link.shortLink,
    destinationUrl: link.destinationUrl,
    state: link.state,
    clicks: link.clicks,
    leads: link.leads,
    conversions: link.conversions,
    sales: link.sales,
    saleAmount: link.saleAmount,
    lastClickedAt: link.lastClickedAt?.toISOString() ?? null,
    refreshedAt: link.sourceRefreshedAt?.toISOString() ?? null,
    error: link.lastError,
  }));
  const attributionByDate = new Map<string, PortalAttributionPoint>();
  for (const snapshot of attributionSnapshotRows) {
    const date = snapshot.bucketAt.toISOString().slice(0, 10);
    const point = attributionByDate.get(date) ?? { date, clicks: 0, leads: 0, conversions: 0, sales: 0, revenue: 0 };
    point.clicks += snapshot.clicks;
    point.leads += snapshot.leads;
    point.conversions += snapshot.conversions;
    point.sales += snapshot.sales;
    point.revenue += snapshot.saleAmount / 100;
    attributionByDate.set(date, point);
  }
  const attribution = { links: attributionLinks, series: [...attributionByDate.values()] };

  const freshnessFor = (source: "viral" | "discord" | "launchpoint" | "dub", staleAfter: number): PortalData["freshness"][number] => {
    const runs = runRows.filter((run) => run.source === source);
    const latestAttempt = runs[0];
    const latestSuccess = runs.find((run) => run.state === "succeeded");
    const successAt = latestSuccess?.finishedAt ?? null;
    if (!latestAttempt) return { source, lastSuccessAt: null, lastAttemptAt: null, state: "not_configured", message: "No synchronization yet" };
    if (latestAttempt.state === "failed") return { source, lastSuccessAt: successAt?.toISOString() ?? null, lastAttemptAt: latestAttempt.startedAt.toISOString(), state: "failed", message: latestAttempt.error ?? "Latest synchronization failed; showing the last successful snapshot" };
    const stale = !successAt || Date.now() - successAt.getTime() > staleAfter;
    return { source, lastSuccessAt: successAt?.toISOString() ?? null, lastAttemptAt: latestAttempt.startedAt.toISOString(), state: stale ? "stale" : "fresh", message: stale ? `Showing ${latestSuccess?.recordsSeen ?? 0} cached records; refresh is overdue` : `${latestSuccess?.recordsSeen ?? 0} records synchronized` };
  };
  const freshness: PortalData["freshness"] = [
    freshnessFor("viral", VIRAL_STALE_AFTER_MS),
    freshnessFor("discord", PROVIDER_STALE_AFTER_MS),
    freshnessFor("launchpoint", PROVIDER_STALE_AFTER_MS),
    freshnessFor("dub", PROVIDER_STALE_AFTER_MS),
    { source: "sideshift", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured", message: "Manual verification only" },
  ];
  const latestRunBySource = new Map<string, (typeof runRows)[number]>();
  for (const run of runRows) if (!latestRunBySource.has(run.source)) latestRunBySource.set(run.source, run);
  const latestFailedBySource = [...latestRunBySource].flatMap(([source, run]) => run.state === "failed" && run.error ? [`${source}: ${run.error}`] : []);

  return {
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
    creators: [...resultCreators, ...unmatched],
    accounts,
    videos,
    activities,
    performance: buildPerformance(videos),
    attribution,
    freshness,
    providerErrors: latestFailedBySource,
    sourceMode: "database",
  };
}
