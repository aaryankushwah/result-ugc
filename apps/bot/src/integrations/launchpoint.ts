const API_BASE = "https://dashboard.launchpointhq.com/api/v1";
import type { ProviderActivity, ProviderCreator, ProviderProgram, ProviderRelationship, SigningProviderAdapter } from "@result/domain";
import { deriveRelationshipState } from "@result/domain";

class LaunchpointApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "LaunchpointApiError";
  }
}

function apiKey(): string {
  const value = process.env.LAUNCHPOINT_API_KEY?.trim();
  if (!value) throw new Error("Launchpoint is not configured. Add LAUNCHPOINT_API_KEY to the bot host's .env.");
  return value;
}

function retryAfterMs(response: Response, attempt: number, baseDelayMs: number): number {
  const header = response.headers.get("retry-after");
  const seconds = header ? Number(header) : Number.NaN;
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 5_000);
  return baseDelayMs * 2 ** attempt;
}

function wait(milliseconds: number): Promise<void> {
  return milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();
}

export async function launchpointGet<T = unknown>(path: string, params: Record<string, string | undefined> = {}, timeoutMs = 30_000, baseRetryDelayMs = 250): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) if (value) url.searchParams.set(key, value);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "x-api-key": apiKey(), Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const payload = await response.json().catch(() => undefined);
      if (response.ok) return payload as T;
      const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `Launchpoint API request failed (${response.status}).`;
      const error = new LaunchpointApiError(response.status, message);
      if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 2) throw error;
      lastError = error;
      await wait(retryAfterMs(response, attempt, baseRetryDelayMs));
    } catch (error) {
      lastError = error;
      if (error instanceof LaunchpointApiError || attempt === 2) throw error;
      await wait(baseRetryDelayMs * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Launchpoint request failed after retries.");
}

/**
 * Launchpoint caps `limit` per endpoint and rejects anything larger with a bare
 * 400 {"error":"Invalid request"}. Verified 2026-08-25: /creators and /contracts
 * allow at most 100, /posts allows 500.
 */
const PAGE_LIMIT: Record<string, number> = { "/creators": 100, "/contracts": 100, "/posts": 500, "/programs": 100 };
const MAX_PAGES = 25;

/** Fetches every page of a Launchpoint collection, respecting its per-endpoint limit. */
export async function launchpointList<T>(path: string, params: Record<string, string | undefined> = {}): Promise<T[]> {
  const limit = PAGE_LIMIT[path] ?? 100;
  const rows: T[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const result = await launchpointGet<{ data?: T[]; totalPages?: number }>(path, {
      ...params,
      limit: String(limit),
      page: String(page),
    });
    const batch = result.data ?? [];
    rows.push(...batch);
    const totalPages = typeof result.totalPages === "number" ? result.totalPages : undefined;
    if (batch.length < limit) break;
    if (totalPages !== undefined && page >= totalPages) break;
  }
  return rows;
}

export type LaunchpointCreator = { id?: string; name?: string; email?: string; username?: string; status?: string };
export type LaunchpointContract = { id?: string; creatorId?: string; programId?: string; programName?: string; status?: string; startDate?: string; endDate?: string; createdAt?: string; updatedAt?: string };
type LaunchpointProgram = { id?: string; name?: string; status?: string };
export type LaunchpointPost = { id?: string; creatorId?: string; contractorName?: string; title?: string; status?: string; uploadedAt?: number; createdAt?: string; url?: string; platform?: string };
export type LaunchpointRelationshipRecord = ProviderRelationship & { creatorExternalId: string };

export function launchpointCreatorDirectoryFromPosts(creators: ProviderCreator[], posts: LaunchpointPost[]): ProviderCreator[] {
  const byId = new Map(creators.map((creator) => [creator.externalId, creator]));
  for (const post of posts) {
    if (!post.creatorId || byId.has(post.creatorId)) continue;
    byId.set(post.creatorId, {
      externalId: post.creatorId,
      displayName: post.contractorName?.trim() || post.creatorId,
      email: null,
      username: null,
      sourceUrl: `https://dashboard.launchpointhq.com/creators/${encodeURIComponent(post.creatorId)}`,
    });
  }
  return [...byId.values()];
}

export class LaunchpointAdapter implements SigningProviderAdapter {
  readonly provider = "launchpoint" as const;
  readonly syncMode = "api" as const;

  async listCreators(): Promise<ProviderCreator[]> {
    const rows = await launchpointList<LaunchpointCreator>("/creators");
    return rows.flatMap((creator) => creator.id ? [this.mapCreator(creator)] : []);
  }

  async listRelationshipRecords(): Promise<LaunchpointRelationshipRecord[]> {
    const rows = await launchpointList<LaunchpointContract>("/contracts");
    return rows.flatMap((contract) => {
      if (!contract.id || !contract.creatorId) return [];
      return [{ ...this.mapRelationship(contract), creatorExternalId: contract.creatorId }];
    });
  }

  async listPosts(): Promise<LaunchpointPost[]> {
    return launchpointList<LaunchpointPost>("/posts");
  }

  async searchCreators(query: string): Promise<ProviderCreator[]> {
    const result = await launchpointGet<{ data?: LaunchpointCreator[] }>("/creators", { limit: "100", search: query });
    return (result.data ?? []).flatMap((creator) => creator.id ? [this.mapCreator(creator)] : []);
  }

  async getCreator(externalId: string): Promise<ProviderCreator | null> {
    const direct = await launchpointGet<{ data?: LaunchpointCreator | LaunchpointCreator[] }>(`/creators/${externalId}`).catch(() => null);
    const value = direct?.data;
    const creator = Array.isArray(value) ? value[0] : value;
    if (creator?.id) return this.mapCreator(creator);
    const result = await launchpointGet<{ data?: LaunchpointCreator[] }>("/creators", { limit: "10", search: externalId });
    const found = (result.data ?? []).find((item) => item.id === externalId);
    return found ? this.mapCreator(found) : null;
  }

  async getRelationships(externalId: string): Promise<ProviderRelationship[]> {
    const result = await launchpointGet<{ data?: LaunchpointContract[] }>("/contracts", { limit: "100", creatorId: externalId });
    return (result.data ?? []).flatMap((contract) => contract.id ? [this.mapRelationship(contract)] : []);
  }

  async getPrograms(): Promise<ProviderProgram[]> {
    const result = await launchpointGet<{ data?: LaunchpointProgram[] }>("/programs", { limit: "100" });
    return (result.data ?? []).flatMap((program) => program.id && program.name ? [{ id: program.id, name: program.name, status: program.status ?? null }] : []);
  }

  async getRecentActivity(since?: Date): Promise<ProviderActivity[]> {
    const posts = await this.listPosts();
    return posts.flatMap((post) => {
      if (!post.id) return [];
      const occurredAt = post.createdAt ?? (post.uploadedAt ? new Date(post.uploadedAt).toISOString() : new Date().toISOString());
      if (since && new Date(occurredAt) < since) return [];
      return [{ id: post.id, type: `post.${post.status ?? "updated"}`, description: post.title ?? "Launchpoint post updated", occurredAt }];
    });
  }

  getDeepLink(externalId: string): string { return `https://dashboard.launchpointhq.com/creators/${encodeURIComponent(externalId)}`; }

  private mapCreator(creator: LaunchpointCreator): ProviderCreator {
    return { externalId: creator.id!, displayName: creator.name ?? creator.username ?? creator.email ?? creator.id!, email: creator.email ?? null, username: creator.username ?? null, sourceUrl: this.getDeepLink(creator.id!) };
  }

  private mapRelationship(contract: LaunchpointContract): ProviderRelationship {
    const status = contract.status?.toLowerCase();
    const active = status ? ["active", "signed", "approved"].includes(status) : null;
    return {
      externalId: contract.id!,
      provider: "launchpoint",
      program: contract.programName ?? contract.programId ?? null,
      state: deriveRelationshipState({ startsAt: contract.startDate ? new Date(contract.startDate) : null, endsAt: contract.endDate ? new Date(contract.endDate) : null, active }),
      startsAt: contract.startDate ?? null,
      endsAt: contract.endDate ?? null,
      sourceUrl: contract.creatorId ? this.getDeepLink(contract.creatorId) : null,
      lastSyncedAt: new Date().toISOString(),
    };
  }
}
