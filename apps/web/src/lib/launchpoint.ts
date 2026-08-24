import "server-only";

import { creatorIdentityKey, type LaunchpointRelationshipInput, type LaunchpointSocialIdentityInput } from "@result/db";
import { deriveRelationshipState, type ProviderCreator } from "@result/domain";

const API_BASE = "https://dashboard.launchpointhq.com/api/v1";

type LaunchpointCreator = { id?: string; name?: string; email?: string; username?: string; status?: string };
type LaunchpointContract = { id?: string; creatorId?: string; programId?: string; programName?: string; status?: string; startDate?: string; endDate?: string };
type LaunchpointPost = { id?: string; creatorId?: string; contractorName?: string; url?: string; platform?: string };

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

function socialIdentity(post: LaunchpointPost, creatorExternalId: string): LaunchpointSocialIdentityInput | null {
  if (!post.url) return null;
  try {
    const url = new URL(post.url);
    const platform = (post.platform ?? (url.hostname.includes("instagram") ? "instagram" : url.hostname.includes("tiktok") ? "tiktok" : url.hostname.includes("youtube") || url.hostname.includes("youtu.be") ? "youtube" : "")).toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let username: string | null = null;
    if (platform === "instagram" && parts[0] && !["p", "reel", "reels", "tv"].includes(parts[0].toLowerCase())) username = parts[0];
    if (platform === "tiktok" && parts[0]?.startsWith("@")) username = parts[0].slice(1);
    if (platform === "youtube" && parts[0]?.startsWith("@")) username = parts[0].slice(1);
    return username ? { creatorExternalId, platform, username: username.replace(/^@/, ""), url: post.url } : null;
  } catch {
    return null;
  }
}

export async function getLaunchpointDataset(): Promise<{
  creators: ProviderCreator[];
  relationships: LaunchpointRelationshipInput[];
  socialIdentities: LaunchpointSocialIdentityInput[];
}> {
  const [creatorResult, contractResult, postResult] = await Promise.all([
    launchpointFetch<{ data?: LaunchpointCreator[] }>("/creators", { limit: "500" }),
    launchpointFetch<{ data?: LaunchpointContract[] }>("/contracts", { limit: "500" }),
    launchpointFetch<{ data?: LaunchpointPost[] }>("/posts", { limit: "500" }),
  ]);
  const rawCreators = (creatorResult.data ?? []).filter((creator): creator is LaunchpointCreator & { id: string } => Boolean(creator.id));
  const creators: ProviderCreator[] = rawCreators.map((creator) => ({ externalId: creator.id, displayName: creator.name ?? creator.username ?? creator.email ?? creator.id, email: creator.email ?? null, username: creator.username ?? null, sourceUrl: `https://dashboard.launchpointhq.com/creators/${encodeURIComponent(creator.id)}` }));
  const relationships: LaunchpointRelationshipInput[] = (contractResult.data ?? []).flatMap((contract) => {
    if (!contract.id || !contract.creatorId) return [];
    const status = contract.status?.toLowerCase();
    const active = status ? ["active", "signed", "approved"].includes(status) : null;
    return [{
      creatorExternalId: contract.creatorId,
      externalId: contract.id,
      provider: "launchpoint" as const,
      program: contract.programName ?? contract.programId ?? null,
      state: deriveRelationshipState({ startsAt: contract.startDate ? new Date(contract.startDate) : null, endsAt: contract.endDate ? new Date(contract.endDate) : null, active }),
      startsAt: contract.startDate ?? null,
      endsAt: contract.endDate ?? null,
      sourceUrl: `https://dashboard.launchpointhq.com/creators/${encodeURIComponent(contract.creatorId)}`,
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
  const socialIdentities = (postResult.data ?? []).flatMap((post) => {
    let creatorExternalId = post.creatorId ?? null;
    if (!creatorExternalId) {
      const key = creatorIdentityKey(post.contractorName);
      const candidates = key ? creatorIdsByName.get(key) : null;
      if (candidates?.size === 1) creatorExternalId = [...candidates][0]!;
    }
    if (!creatorExternalId) return [];
    const identity = socialIdentity(post, creatorExternalId);
    return identity ? [identity] : [];
  });
  return { creators, relationships, socialIdentities };
}
