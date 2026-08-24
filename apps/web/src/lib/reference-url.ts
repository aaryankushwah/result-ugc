export type ReferencePlatform = "instagram" | "tiktok";

export type ParsedReference =
  /** A directly usable platform video id. */
  | { kind: "video"; platform: ReferencePlatform; videoId: string; canonicalUrl: string }
  /** A TikTok share link that must be expanded before the numeric id is known. */
  | { kind: "short_link"; platform: "tiktok"; url: string }
  | { kind: "unsupported"; reason: string };

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am", "www.instagr.am"]);
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com"]);
const TIKTOK_SHORT_HOSTS = new Set(["vm.tiktok.com", "vt.tiktok.com"]);

/** Instagram shortcodes are base64-ish: letters, digits, dash and underscore. */
const INSTAGRAM_SHORTCODE = /^[A-Za-z0-9_-]{5,64}$/;
/** TikTok video ids are long numeric snowflakes. */
const TIKTOK_VIDEO_ID = /^\d{8,25}$/;

export function canonicalUrlFor(platform: ReferencePlatform, videoId: string): string {
  return platform === "instagram"
    ? `https://www.instagram.com/reel/${videoId}/`
    : `https://www.tiktok.com/video/${videoId}`;
}

/**
 * Parses a pasted reference URL without contacting any provider.
 * TikTok share links resolve to `short_link`, which the ingest route expands
 * through Viral's free resolver before looking the video up.
 */
export function parseReferenceUrl(input: string): ParsedReference {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "unsupported", reason: "Paste a reel or TikTok link to get started." };

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { kind: "unsupported", reason: "That does not look like a link." };
  }

  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split("/").filter(Boolean);

  if (TIKTOK_SHORT_HOSTS.has(host)) {
    if (!segments.length) return { kind: "unsupported", reason: "That TikTok share link is incomplete." };
    return { kind: "short_link", platform: "tiktok", url: `https://${host}/${segments[0]}` };
  }

  if (TIKTOK_HOSTS.has(host)) {
    // /t/<code> is another share form that still needs expanding.
    if (segments[0] === "t" && segments[1]) return { kind: "short_link", platform: "tiktok", url: url.toString() };
    // Handles /@user/video/ID, /video/ID and /v/ID.html
    const markerIndex = segments.findIndex((segment) => segment === "video" || segment === "v");
    const raw = markerIndex >= 0 ? segments[markerIndex + 1] : undefined;
    const videoId = raw?.replace(/\.html$/, "");
    if (!videoId || !TIKTOK_VIDEO_ID.test(videoId)) {
      return { kind: "unsupported", reason: "That TikTok link does not point at a single video." };
    }
    return { kind: "video", platform: "tiktok", videoId, canonicalUrl: canonicalUrlFor("tiktok", videoId) };
  }

  if (INSTAGRAM_HOSTS.has(host)) {
    // Handles /reel/CODE, /reels/CODE, /p/CODE and /<user>/reel/CODE
    const markerIndex = segments.findIndex((segment) => segment === "reel" || segment === "reels" || segment === "p");
    const videoId = markerIndex >= 0 ? segments[markerIndex + 1] : undefined;
    if (!videoId || !INSTAGRAM_SHORTCODE.test(videoId)) {
      return { kind: "unsupported", reason: "That Instagram link does not point at a reel or post." };
    }
    return { kind: "video", platform: "instagram", videoId, canonicalUrl: canonicalUrlFor("instagram", videoId) };
  }

  return { kind: "unsupported", reason: `${url.hostname} is not supported. Paste an Instagram reel or TikTok link.` };
}

export function referencePlatformOf(parsed: ParsedReference): ReferencePlatform | null {
  if (parsed.kind === "video") return parsed.platform;
  if (parsed.kind === "short_link") return parsed.platform;
  return null;
}
