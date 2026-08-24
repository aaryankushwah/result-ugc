import "server-only";

export { parseReferenceUrl, referencePlatformOf, type ParsedReference, type ReferencePlatform } from "./reference-url";

export type ResolvedReel = {
  videoUrl: string;
  author: string | null;
  caption: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  raw: Record<string, unknown>;
};

const APIFY_ACTOR = "apify~instagram-scraper";

export class ReferenceResolutionError extends Error {}

/**
 * Resolves an Instagram shortcode to a direct media URL via the Apify actor.
 * Provider work belongs in a route handler, never in a render path.
 */
export async function resolveInstagramReel(shortcode: string, signal?: AbortSignal): Promise<ResolvedReel> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ReferenceResolutionError("APIFY_TOKEN is not configured, so reel links cannot be resolved. Paste the transcript manually instead.");

  const endpoint = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      directUrls: [`https://www.instagram.com/reel/${shortcode}/`],
      resultsType: "posts",
      resultsLimit: 1,
      addParentData: false,
    }),
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new ReferenceResolutionError(`The reel could not be resolved (scraper returned ${response.status}). Paste the transcript manually instead.`);
  }

  const items = (await response.json()) as unknown;
  const item = Array.isArray(items) ? (items[0] as Record<string, unknown> | undefined) : undefined;
  if (!item) throw new ReferenceResolutionError("The reel could not be read. It may be private or removed.");

  const videoUrl = firstString(item, ["videoUrl", "videoUrlLowBandwidth", "displayUrl"]);
  if (!videoUrl) throw new ReferenceResolutionError("That post has no video track to transcribe.");

  return {
    videoUrl,
    author: firstString(item, ["ownerUsername", "ownerFullName"]),
    caption: firstString(item, ["caption"]),
    durationSeconds: firstNumber(item, ["videoDuration", "duration"]),
    thumbnailUrl: firstString(item, ["displayUrl", "thumbnailUrl"]),
    raw: item,
  };
}

function firstString(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  }
  return null;
}
