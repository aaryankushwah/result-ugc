import "server-only";

import {
  brandProfiles,
  creators,
  discordOperations,
  getDatabase,
  hasDatabase,
  organizations,
  scriptAssignments,
  scriptAssets,
  scriptReferences,
  scriptTests,
  scripts,
  type ScriptSection,
  type TranscriptSection,
} from "@result/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { PORTAL_DATA_CACHE_TAG } from "./portal-cache";
import { getPortalData } from "./portal-data";
import { isPersistedCreatorId, unavailableScriptStudioData } from "./script-studio-state";

export type StudioCreator = {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  specialties: string[];
  activeAssignments: number;
};

export type StudioAsset = {
  id: string;
  label: string;
  kind: string;
  sourceUrl: string | null;
  downloadUrl: string | null;
};

export type StudioScript = {
  id: string;
  latestVersion: number;
  title: string;
  status: "draft" | "ready" | "assigned" | "in_review" | "approved" | "published" | "archived";
  pipelineStage: "not_started" | "testing" | "iterate" | "winner" | "retired";
  priority: "low" | "medium" | "high";
  category: string;
  format: string;
  tags: string[];
  targetPlatform: string;
  durationSeconds: number | null;
  hook: string | null;
  sections: ScriptSection[];
  reference: {
    id: string;
    sourcePlatform: string;
    sourceUrl: string | null;
    sourceCreator: string | null;
    transcript: string;
    transcriptSections: TranscriptSection[];
  } | null;
  assignments: Array<{ id: string; creatorId: string; creatorName: string; state: string; dueAt: string | null }>;
  assets: StudioAsset[];
  performance: { tests: number; liveTests: number; views: number; hookRate: number | null; averageWatchTimeSeconds: number | null };
  updatedAt: string;
};

type FailedNotification = {
  operationId: string;
  creatorName: string | null;
  scriptTitle: string;
  lastError: string | null;
};

export type ScriptStudioData = {
  sourceMode: "database" | "unavailable";
  failedNotifications: FailedNotification[];
  brand: { name: string; productDescription: string; audience: string; voice: string[]; bannedPhrases: string[]; proofPoints: string[] };
  scripts: StudioScript[];
  creators: StudioCreator[];
};

type StudioRecords = {
  brand: ScriptStudioData["brand"];
  scripts: StudioScript[];
  activeByCreator: Array<[string, number]>;
  failedNotifications: FailedNotification[];
};

/**
 * Reads every Script Studio record for the org. Returns plain JSON-safe values
 * (timestamps already stringified) because unstable_cache serialises the result.
 */
async function loadStudioRecords(): Promise<StudioRecords | null> {
  if (!hasDatabase()) return null;
  try {
    const db = getDatabase();
    const organization = (await db.select().from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
    if (!organization) return null;
    const [brand, rows] = await Promise.all([
      db.select().from(brandProfiles).where(eq(brandProfiles.organizationId, organization.id)).limit(1),
      db.select({
        id: scripts.id,
        latestVersion: scripts.latestVersion,
        title: scripts.title,
        status: scripts.status,
        pipelineStage: scripts.pipelineStage,
        priority: scripts.priority,
        category: scripts.category,
        format: scripts.format,
        tags: scripts.tags,
        targetPlatform: scripts.targetPlatform,
        durationSeconds: scripts.durationSeconds,
        hook: scripts.hook,
        sections: scripts.sections,
        updatedAt: scripts.updatedAt,
        referenceId: scriptReferences.id,
        sourcePlatform: scriptReferences.sourcePlatform,
        sourceUrl: scriptReferences.sourceUrl,
        sourceCreator: scriptReferences.sourceCreator,
        transcript: scriptReferences.transcript,
        transcriptSections: scriptReferences.transcriptSections,
      }).from(scripts).leftJoin(scriptReferences, eq(scriptReferences.id, scripts.referenceId)).where(eq(scripts.organizationId, organization.id)).orderBy(desc(scripts.updatedAt)).limit(100),
    ]);

    const scriptIds = rows.map((row) => row.id);
    const [assignmentRows, assetRows, testRows] = scriptIds.length ? await Promise.all([
      db.select({ id: scriptAssignments.id, scriptId: scriptAssignments.scriptId, creatorId: scriptAssignments.creatorId, creatorName: creators.displayName, state: scriptAssignments.state, dueAt: scriptAssignments.dueAt })
        .from(scriptAssignments).innerJoin(creators, and(eq(creators.id, scriptAssignments.creatorId), eq(creators.organizationId, organization.id)))
        .where(and(eq(scriptAssignments.organizationId, organization.id), inArray(scriptAssignments.scriptId, scriptIds))),
      db.select().from(scriptAssets).where(and(eq(scriptAssets.organizationId, organization.id), inArray(scriptAssets.scriptId, scriptIds))),
      db.select().from(scriptTests).where(and(eq(scriptTests.organizationId, organization.id), inArray(scriptTests.scriptId, scriptIds))),
    ]) : [[], [], []];

    // Surface Discord notifications that failed after the portal reported "queued",
    // otherwise a broken handoff is invisible to the manager who caused it.
    const failedOperations = await db
      .select({ id: discordOperations.id, payload: discordOperations.payload, lastError: discordOperations.lastError, creatorName: creators.displayName })
      .from(discordOperations)
      .leftJoin(creators, eq(creators.id, discordOperations.creatorId))
      .where(and(
        eq(discordOperations.organizationId, organization.id),
        eq(discordOperations.type, "send_script_assignment"),
        eq(discordOperations.state, "failed"),
      ))
      .orderBy(desc(discordOperations.updatedAt))
      .limit(10);

    const activeByCreator = new Map<string, number>();
    for (const assignment of assignmentRows) {
      if (!["approved", "cancelled"].includes(assignment.state)) activeByCreator.set(assignment.creatorId, (activeByCreator.get(assignment.creatorId) ?? 0) + 1);
    }

    return {
      brand: brand[0] ? {
        name: brand[0].name,
        productDescription: brand[0].productDescription,
        audience: brand[0].audience,
        voice: brand[0].voice,
        bannedPhrases: brand[0].bannedPhrases,
        proofPoints: brand[0].proofPoints,
      } : defaultBrand,
      activeByCreator: [...activeByCreator.entries()],
      failedNotifications: failedOperations.map((operation) => ({
        operationId: operation.id,
        creatorName: operation.creatorName,
        scriptTitle: typeof operation.payload.scriptTitle === "string" ? operation.payload.scriptTitle : "a script",
        lastError: operation.lastError,
      })),
      scripts: rows.map((row) => {
        const tests = testRows.filter((test) => test.scriptId === row.id);
        const hookRates = tests.map((test) => test.hookRate).filter((value): value is number => value !== null);
        const watchTimes = tests.map((test) => test.averageWatchTimeSeconds).filter((value): value is number => value !== null);
        return {
          id: row.id,
          latestVersion: row.latestVersion,
          title: row.title,
          status: row.status,
          pipelineStage: row.pipelineStage,
          priority: row.priority,
          category: row.category,
          format: row.format,
          tags: row.tags,
          targetPlatform: row.targetPlatform,
          durationSeconds: row.durationSeconds,
          hook: row.hook,
          sections: row.sections,
          reference: row.referenceId && row.transcript ? {
            id: row.referenceId,
            sourcePlatform: row.sourcePlatform ?? "instagram",
            sourceUrl: row.sourceUrl,
            sourceCreator: row.sourceCreator,
            transcript: row.transcript,
            transcriptSections: row.transcriptSections ?? [],
          } : null,
          assignments: assignmentRows.filter((assignment) => assignment.scriptId === row.id).map((assignment) => ({ ...assignment, dueAt: assignment.dueAt?.toISOString() ?? null })),
          assets: assetRows.filter((asset) => asset.scriptId === row.id).map((asset) => ({ id: asset.id, label: asset.label, kind: asset.kind, sourceUrl: asset.sourceUrl, downloadUrl: asset.downloadUrl })),
          performance: {
            tests: tests.length,
            liveTests: tests.filter((test) => test.state === "live").length,
            views: tests.reduce((total, test) => total + test.views, 0),
            hookRate: hookRates.length ? hookRates.reduce((total, value) => total + value, 0) / hookRates.length : null,
            averageWatchTimeSeconds: watchTimes.length ? watchTimes.reduce((total, value) => total + value, 0) / watchTimes.length : null,
          },
          updatedAt: row.updatedAt.toISOString(),
        };
      }),
    };
  } catch (error) {
    console.error("Script Studio records unavailable", error);
    return null;
  }
}

const getCachedStudioRecords = unstable_cache(
  loadStudioRecords,
  ["result-script-studio-v2"],
  { revalidate: 30, tags: [PORTAL_DATA_CACHE_TAG] },
);

export async function getScriptStudioData(): Promise<ScriptStudioData> {
  // These reads are independent. Fetching them together keeps a cold Script
  // Studio load to the slower query instead of the sum of both query times.
  const [portalData, records] = await Promise.all([getPortalData(), getCachedStudioRecords()]);
  const studioCreators: StudioCreator[] = portalData.creators.filter((creator) => isPersistedCreatorId(creator.id)).map((creator) => ({
    id: creator.id,
    name: creator.displayName,
    username: creator.discord.username ?? creator.accounts[0]?.username ?? null,
    avatarUrl: creator.discord.avatarUrl ?? creator.accounts[0]?.avatarUrl ?? null,
    specialties: creator.accounts.map((account) => account.platform).slice(0, 3),
    activeAssignments: 0,
  }));

  if (!records) return unavailableScriptStudioData(studioCreators, defaultBrand);

  const activeByCreator = new Map(records.activeByCreator);
  return {
    sourceMode: "database",
    failedNotifications: records.failedNotifications,
    brand: records.brand,
    creators: studioCreators.map((creator) => ({ ...creator, activeAssignments: activeByCreator.get(creator.id) ?? 0 })),
    scripts: records.scripts,
  };
}

const defaultBrand = {
  name: "Result",
  productDescription: "The operating system for high-output UGC teams.",
  audience: "UGC managers, DTC founders, and creator operations teams",
  voice: ["Clear", "Sharp", "Human"],
  bannedPhrases: ["Revolutionary", "Game-changing", "Unlock magic"],
  proofPoints: ["One connected creator workflow", "Faster review and handoff", "Source-backed creative decisions"],
};
