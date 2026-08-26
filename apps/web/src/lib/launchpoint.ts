import "server-only";

import { creatorIdentityKey, type LaunchpointRelationshipInput, type LaunchpointSocialIdentityInput } from "@result/db";
import { deriveRelationshipState, launchpointSocialIdentityFromPost, type ProviderCreator } from "@result/domain";

const API_BASE = "https://dashboard.launchpointhq.com/api/v1";

type LaunchpointCreator = { id?: string; name?: string; email?: string; username?: string; status?: string };
type LaunchpointContract = { id?: string; contractorId?: string; contractorName?: string; programId?: string; contractName?: string; status?: string; startsAt?: string | number; expiresAt?: string | number };
type LaunchpointPost = { id?: string; creatorId?: string; contractorName?: string; url?: string; platform?: string };
type LaunchpointPage<T> = { data?: T[]; page?: number; total?: number; totalPages?: number };

// Launchpoint rejects larger limits; /posts permits 500 while the other
// collections cap at 100. Keeping this endpoint-specific avoids 5x requests.
const PAGE_LIMIT: Record<string, number> = { "/creators": 100, "/contracts": 100, "/posts": 500 };
const MAX_PAGES = 25;

async function launchpointFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = process.env.LAUNCHPOINT_API_KEY?.trim();
  if (!key) throw new Error("Launchpoint API is not configured");
  const url = new URL(`${API_BASE}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, { headers: { "x-api-key": key, accept: "application/json" }, signal: AbortSignal.timeout(20_000) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : `Launchpoint returned ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function launchpointBrowse<T>(path: string, params: Record<string, string> = {}): Promise<T[]> {
  const rows: T[] = [];
  const limit = PAGE_LIMIT[path] ?? 100;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await launchpointFetch<LaunchpointPage<T>>(path, { ...params, page: String(page), limit: String(limit) });
    const batch = result.data ?? [];
    rows.push(...batch);
    const totalPages = result.totalPages ?? (typeof result.total === "number" ? Math.ceil(result.total / limit) : null);
    if (!batch.length || (totalPages !== null && page >= totalPages) || (totalPages === null && batch.length < limit)) break;
  }
  return rows;
}

function timestamp(value: string | number | undefined): string | null {
  if (value === undefined || value === "") return null;
  const numeric = typeof value === "number" && value < 1_000_000_000_000 ? value * 1_000 : value;
  const date = new Date(numeric);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function getLaunchpointDataset(): Promise<{
  creators: ProviderCreator[];
  relationships: LaunchpointRelationshipInput[];
  socialIdentities: LaunchpointSocialIdentityInput[];
}> {
  const [creatorResult, contractResult, postResult] = await Promise.all([
    launchpointBrowse<LaunchpointCreator>("/creators"),
    launchpointBrowse<LaunchpointContract>("/contracts", { scope: "company" }),
    launchpointBrowse<LaunchpointPost>("/posts"),
  ]);
  const creatorById = new Map<string, LaunchpointCreator & { id: string }>();
  for (const creator of creatorResult) {
    if (creator.id) creatorById.set(creator.id, { ...creator, id: creator.id });
  }
  // The public creators/contracts endpoints can be empty for campaign-only
  // workspaces even when posts expose stable creator IDs. Posts are therefore
  // a valid directory fallback, while contract state remains provider-owned.
  for (const contract of contractResult) {
    if (!contract.contractorId || creatorById.has(contract.contractorId)) continue;
    creatorById.set(contract.contractorId, { id: contract.contractorId, name: contract.contractorName });
  }
  for (const post of postResult) {
    if (!post.creatorId || creatorById.has(post.creatorId)) continue;
    creatorById.set(post.creatorId, { id: post.creatorId, name: post.contractorName });
  }
  const rawCreators = [...creatorById.values()];
  const creators: ProviderCreator[] = rawCreators.map((creator) => ({ externalId: creator.id, displayName: creator.name ?? creator.username ?? creator.email ?? creator.id, email: creator.email ?? null, username: creator.username ?? null, sourceUrl: `https://dashboard.launchpointhq.com/creators/${encodeURIComponent(creator.id)}` }));
  const relationships: LaunchpointRelationshipInput[] = contractResult.flatMap((contract) => {
    if (!contract.id || !contract.contractorId) return [];
    const status = contract.status?.toLowerCase();
    const active = status ? ["active", "signed", "approved"].includes(status) : null;
    const startsAt = timestamp(contract.startsAt);
    const endsAt = timestamp(contract.expiresAt);
    return [{
      creatorExternalId: contract.contractorId,
      externalId: contract.id,
      provider: "launchpoint" as const,
      program: contract.contractName ?? contract.programId ?? null,
      state: deriveRelationshipState({ startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null, active }),
      startsAt,
      endsAt,
      sourceUrl: `https://dashboard.launchpointhq.com/creators/${encodeURIComponent(contract.contractorId)}`,
      lastSyncedAt: new Date().toISOString(),
    }];
  });
  const creatorIdsByName = new Map<string, Set<string>>();
  for (const creator of creators) {
    for (const value of [creator.displayName, creator.username, creator.email]) {
      const key = creatorIdentityKey(value);
      if (!key) continue;
      const ids = creatorIdsByName.get(key) ?? new Set<string>();
      ids.add(creator.externalId);
      creatorIdsByName.set(key, ids);
    }
  }
  const socialIdentities = postResult.flatMap((post) => {
    let creatorExternalId = post.creatorId ?? null;
    if (!creatorExternalId) {
      const key = creatorIdentityKey(post.contractorName);
      const candidates = key ? creatorIdsByName.get(key) : null;
      if (candidates?.size === 1) creatorExternalId = [...candidates][0]!;
    }
    if (!creatorExternalId) return [];
    const identity = launchpointSocialIdentityFromPost(post, creatorExternalId);
    return identity ? [identity] : [];
  });
  return { creators, relationships, socialIdentities };
}
