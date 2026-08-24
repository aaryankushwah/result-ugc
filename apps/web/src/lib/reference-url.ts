export type ReferencePlatform = "instagram" | "tiktok" | "unknown";

export type ParsedReference =
  | { kind: "instagram"; shortcode: string; canonicalUrl: string }
  | { kind: "coming_soon"; platform: "tiktok" }
  | { kind: "unsupported"; reason: string };

const INSTAGRAM_HOSTS = new Set(["instagram.com", "www.instagram.com", "m.instagram.com", "instagr.am", "www.instagr.am"]);
const TIKTOK_HOSTS = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);

/** Instagram shortcodes are base64-ish: letters, digits, dash and underscore. */
const SHORTCODE = /^[A-Za-z0-9_-]{5,64}$/;

/**
 * Parses a pasted reference URL without contacting any provider.
 * TikTok resolves to an explicit `coming_soon` result so the studio can say so
 * without spending a scraper call.
 */
export function parseReferenceUrl(input: string): ParsedReference {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "unsupported", reason: "Paste a reel link to get started." };

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`);
  } catch {
    return { kind: "unsupported", reason: "That does not look like a link." };
  }

  const host = url.hostname.toLowerCase();
  if (TIKTOK_HOSTS.has(host)) return { kind: "coming_soon", platform: "tiktok" };
  if (!INSTAGRAM_HOSTS.has(host)) {
    return { kind: "unsupported", reason: `${url.hostname} is not supported yet. Paste an Instagram reel link.` };
  }

  const segments = url.pathname.split("/").filter(Boolean);
  // Handles /reel/CODE, /reels/CODE, /p/CODE and /<user>/reel/CODE
  const markerIndex = segments.findIndex((segment) => segment === "reel" || segment === "reels" || segment === "p");
  const shortcode = markerIndex >= 0 ? segments[markerIndex + 1] : undefined;
  if (!shortcode || !SHORTCODE.test(shortcode)) {
    return { kind: "unsupported", reason: "That Instagram link does not point at a reel or post." };
  }

  return { kind: "instagram", shortcode, canonicalUrl: `https://www.instagram.com/reel/${shortcode}/` };
}

export function referencePlatformOf(parsed: ParsedReference): ReferencePlatform {
  if (parsed.kind === "instagram") return "instagram";
  if (parsed.kind === "coming_soon") return parsed.platform;
  return "unknown";
}
