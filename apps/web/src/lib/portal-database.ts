import "server-only";

import { activityEvents, creatorDiscord, creatorNotes, creators, getDatabase, internalUsers, organizations, signingRelationships, socialAccounts, syncRuns } from "@result/db";
import { desc, eq } from "drizzle-orm";
import type { PortalActivity, PortalCreator, PortalData, PortalRelationship } from "./portal-types";
import { getLiveViralData } from "./viral";

export async function getDatabasePortalData(): Promise<PortalData | null> {
  if (!process.env.DATABASE_URL) return null;
  const db = getDatabase();
  const organization = (await db.select().from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (!organization) return null;
  const [creatorRows, discordRows, relationshipRows, accountMappings, userRows, noteRows, activityRows, runRows, live] = await Promise.all([
    db.select().from(creators).where(eq(creators.organizationId, organization.id)),
    db.select().from(creatorDiscord).where(eq(creatorDiscord.organizationId, organization.id)),
    db.select().from(signingRelationships).where(eq(signingRelationships.organizationId, organization.id)),
    db.select().from(socialAccounts).where(eq(socialAccounts.organizationId, organization.id)),
    db.select().from(internalUsers).where(eq(internalUsers.organizationId, organization.id)),
    db.select().from(creatorNotes).where(eq(creatorNotes.organizationId, organization.id)).orderBy(desc(creatorNotes.createdAt)),
    db.select().from(activityEvents).where(eq(activityEvents.organizationId, organization.id)).orderBy(desc(activityEvents.occurredAt)).limit(250),
    db.select().from(syncRuns).where(eq(syncRuns.organizationId, organization.id)).orderBy(desc(syncRuns.startedAt)).limit(100),
    getLiveViralData(),
  ]);
  const mappingByViralId = new Map(accountMappings.map((mapping) => [mapping.viralOrgAccountId, mapping]));
  const accounts = live.accounts.map((account) => {
    const mapping = mappingByViralId.get(account.id);
    return { ...account, creatorId: mapping?.creatorId ?? null, linkState: mapping?.linkState ?? "unlinked" };
  });
  const creatorById = new Map(creatorRows.map((creator) => [creator.id, creator]));
  const managerById = new Map(userRows.map((user) => [user.id, user.displayName]));
  const cutoff = Date.now() - 30 * 86_400_000;
  const resultCreators: PortalCreator[] = creatorRows.map((creator) => {
    const connection = discordRows.find((row) => row.creatorId === creator.id);
    const creatorAccounts = accounts.filter((account) => account.creatorId === creator.id);
    const accountIds = new Set(creatorAccounts.map((account) => account.id));
    const recentVideos = live.videos.filter((video) => accountIds.has(video.accountId) && video.publishedAt && new Date(video.publishedAt).getTime() >= cutoff);
    const views = recentVideos.reduce((sum, video) => sum + (video.included ? video.views : 0), 0);
    const interactions = recentVideos.reduce((sum, video) => sum + video.likes + video.comments + video.shares + video.bookmarks, 0);
    const relationships: PortalRelationship[] = relationshipRows.filter((row) => row.creatorId === creator.id).map((row) => ({ id: row.id, provider: row.provider, syncMode: row.syncMode, program: row.program, state: row.state, startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null, sourceUrl: row.sourceUrl, lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null, error: row.lastError }));
    const trackingState = creatorAccounts.some((account) => account.trackingState === "failed") ? "failed" : creatorAccounts.some((account) => account.trackingState === "stale") ? "stale" : creatorAccounts.length ? "healthy" : "untracked";
    return { id: creator.id, displayName: creator.displayName, email: creator.email, lifecycle: creator.lifecycle, attentionState: creator.attentionState, nextStep: creator.nextStep, managerName: creator.managerUserId ? managerById.get(creator.managerUserId) ?? null : null, discord: { state: connection?.state ?? "unknown", username: connection?.username ?? null, displayName: connection?.displayName ?? null, avatarUrl: connection?.avatarUrl ?? null, channelId: connection?.privateChannelId ?? null, guildId: connection?.guildId ?? organization.discordGuildId }, relationships, accounts: creatorAccounts, notes: noteRows.filter((note) => note.creatorId === creator.id).map((note) => ({ id: note.id, body: note.body, author: note.authorUserId ? managerById.get(note.authorUserId) ?? null : null, createdAt: note.createdAt.toISOString() })), posts30d: recentVideos.length, views30d: views, engagementRate: views ? interactions / views : 0, trackingState, lastActivityAt: creator.lastActivityAt?.toISOString() ?? null, source: "result" } satisfies PortalCreator;
  });
  const matched = new Set(accounts.filter((account) => account.creatorId).map((account) => account.id));
  const unmatched = accounts.filter((account) => !matched.has(account.id)).map((account) => ({ id: `viral-${account.id}`, displayName: account.displayName, email: null, lifecycle: "request" as const, attentionState: "Needs creator confirmation", nextStep: "Match this account to its Result creator", managerName: null, discord: { state: "unknown" as const, username: null, displayName: null, avatarUrl: null, channelId: null, guildId: organization.discordGuildId }, relationships: [], accounts: [{ ...account, creatorId: `viral-${account.id}` }], notes: [], posts30d: live.videos.filter((video) => video.accountId === account.id && video.publishedAt && new Date(video.publishedAt).getTime() >= cutoff).length, views30d: live.videos.filter((video) => video.accountId === account.id && video.publishedAt && new Date(video.publishedAt).getTime() >= cutoff).reduce((sum, video) => sum + video.views, 0), engagementRate: account.engagementRate, trackingState: account.trackingState, lastActivityAt: account.latestPostAt, source: "viral_candidate" as const }));
  const videos = live.videos.map((video) => ({ ...video, creatorId: accounts.find((account) => account.id === video.accountId)?.creatorId ?? null }));
  const activities: PortalActivity[] = activityRows.map((event) => ({ id: event.id, creatorId: event.creatorId, creatorName: event.creatorId ? creatorById.get(event.creatorId)?.displayName ?? null : null, type: event.type, summary: event.summary, actor: event.actorUserId ? managerById.get(event.actorUserId) ?? null : event.actorDiscordUserId ? `Discord ${event.actorDiscordUserId}` : "System", occurredAt: event.occurredAt.toISOString() }));
  const lastRun = (source: string) => runRows.find((run) => run.source === source);
  const newestRefresh = accounts.map((account) => account.refreshedAt).filter(Boolean).sort().at(-1) ?? null;
  const freshness: PortalData["freshness"] = [
    { source: "viral", lastSuccessAt: newestRefresh, lastAttemptAt: new Date().toISOString(), state: "fresh", message: `${accounts.length} accounts read live` },
    ...(["discord", "launchpoint"] as const).map((source) => { const run = lastRun(source); return { source, lastSuccessAt: run?.state === "succeeded" ? run.finishedAt?.toISOString() ?? null : null, lastAttemptAt: run?.startedAt.toISOString() ?? null, state: !run ? "not_configured" as const : run.state === "succeeded" ? "fresh" as const : "failed" as const, message: run?.error ?? (run ? `${run.recordsSeen ?? 0} records` : "No synchronization yet") }; }),
    { source: "sideshift", lastSuccessAt: null, lastAttemptAt: null, state: "not_configured", message: "Manual verification only" },
  ];
  return { organization: { id: organization.id, name: organization.name, slug: organization.slug }, creators: [...resultCreators, ...unmatched], accounts, videos, activities, performance: performance(videos), freshness, providerErrors: runRows.filter((run) => run.state === "failed" && run.error).map((run) => `${run.source}: ${run.error}`), sourceMode: "database" };
}

function performance(videos: PortalData["videos"]): PortalData["performance"] {
  const result = new Map<string, { views: number; posts: number }>(); const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  for (let i = 29; i >= 0; i -= 1) { const date = new Date(today); date.setUTCDate(date.getUTCDate() - i); result.set(date.toISOString().slice(0, 10), { views: 0, posts: 0 }); }
  for (const video of videos) { if (!video.included || !video.publishedAt) continue; const point = result.get(video.publishedAt.slice(0, 10)); if (point) { point.views += video.views; point.posts += 1; } }
  return [...result.entries()].map(([date, values]) => ({ date, ...values }));
}
