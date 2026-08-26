import "server-only";

import { canonicalUrlFor, parseReferenceUrl, type ReferencePlatform } from "./reference-url";

export { parseReferenceUrl } from "./reference-url";

export type ResolvedReel = {
  platform: ReferencePlatform;
  videoId: string;
  canonicalUrl: string;
  videoUrl: string;
  author: string | null;
  caption: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  raw: Record<string, unknown>;
};

export class ReferenceResolutionError extends Error {}

const VIRAL_API_URL = "https://viral.app/api/v1";

function apiKey(): string {
  const key = process.env.VIRAL_APP_API_KEY;
  if (!key) throw new ReferenceResolutionError("VIRAL_APP_API_KEY is not configured, so links cannot be resolved. Paste the transcript manually instead.");
  return key;
}

/**
 * Expands a TikTok share link (vm.tiktok.com/…, /t/…) into its canonical URL so
 * the numeric video id can be read. Free — consumes no Viral credits.
 */
async function resolveTikTokShortUrl(shortUrl: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(`${VIRAL_API_URL}/videos/tracked/resolve-tiktok-short-url`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey() },
    body: JSON.stringify({ url: shortUrl }),
    signal: signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new ReferenceResolutionError(`That TikTok share link could not be expanded (${response.status}). Paste the full tiktok.com link instead.`);

  const payload = (await response.json()) as { resolved?: boolean; resolvedUrl?: unknown; errorMessage?: unknown };
  const resolvedUrl = typeof payload.resolvedUrl === "string" ? payload.resolvedUrl : null;

  // Viral reports `resolved: false` when it cannot recover the username, yet it
  // still returns a URL carrying the numeric video id — which is all we need.
  // Trust the id, not the flag.
  if (resolvedUrl && parseReferenceUrl(resolvedUrl).kind === "video") return resolvedUrl;

  const detail = typeof payload.errorMessage === "string" && payload.errorMessage ? ` ${payload.errorMessage}` : "";
  throw new ReferenceResolutionError(`That TikTok share link could not be expanded.${detail} Paste the full tiktok.com link instead.`);
}

/**
 * Resolves a pasted URL to a direct MP4 plus source metadata using Viral's
 * one-off live lookup — the same provider the portal already uses for account
 * and video analytics, so no extra vendor or key is involved.
 *
 * Costs 3 Viral credits per call. Works for any public video, tracked or not:
 * `/videos/{platform}/{id}/download` is limited to videos the organization
 * already tracks, whereas `/live/...` reads fresh upstream data.
 */
async function resolveReference(input: { platform: ReferencePlatform; videoId: string }, signal?: AbortSignal): Promise<ResolvedReel> {
  const { platform, videoId } = input;
  const response = await fetch(`${VIRAL_API_URL}/live/${platform}/videos/${encodeURIComponent(videoId)}`, {
    headers: { "x-api-key": apiKey() },
    signal: signal ?? AbortSignal.timeout(30_000),
  });

  const label = platform === "instagram" ? "reel" : "TikTok";
  if (response.status === 404) throw new ReferenceResolutionError(`That ${label} could not be found. It may be private, removed, or the link may be wrong.`);
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    throw new ReferenceResolutionError(`Viral is rate limiting lookups${retryAfter ? `; try again in ${retryAfter}s` : ""}. Paste the transcript manually instead.`);
  }
  if (response.status === 402 || response.status === 403) {
    throw new ReferenceResolutionError("Viral rejected the lookup — the plan may be out of credits. Paste the transcript manually instead.");
  }
  if (!response.ok) throw new ReferenceResolutionError(`The ${label} could not be resolved (Viral returned ${response.status}). Paste the transcript manually instead.`);

  const item = (await response.json()) as Record<string, unknown>;
  const videoUrl = typeof item.download_url === "string" ? item.download_url : null;
  if (!videoUrl) throw new ReferenceResolutionError(`That ${label} has no downloadable video track to transcribe.`);

  return {
    platform,
    videoId,
    canonicalUrl: canonicalUrlFor(platform, videoId),
    videoUrl,
    author: stringOrNull(item.account_username),
    caption: stringOrNull(item.caption),
    durationSeconds: typeof item.duration_seconds === "number" ? Math.round(item.duration_seconds) : null,
    thumbnailUrl: stringOrNull(item.thumbnail_url),
    raw: item,
  };
}

/**
 * Turns a pasted URL into a resolvable video, expanding a TikTok share link
 * first when needed.
 */
export async function resolvePastedUrl(url: string, signal?: AbortSignal): Promise<ResolvedReel> {
  let parsed = parseReferenceUrl(url);

  if (parsed.kind === "short_link") {
    const expanded = await resolveTikTokShortUrl(parsed.url, signal);
    parsed = parseReferenceUrl(expanded);
    if (parsed.kind === "short_link") throw new ReferenceResolutionError("That TikTok share link did not expand to a single video.");
  }
  if (parsed.kind === "unsupported") throw new ReferenceResolutionError(parsed.reason);

  return resolveReference({ platform: parsed.platform, videoId: parsed.videoId }, signal);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
