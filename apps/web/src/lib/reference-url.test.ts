import { describe, expect, it } from "vitest";
import { parseReferenceUrl, referencePlatformOf } from "./reference-url";

describe("parseReferenceUrl", () => {
  it("accepts every Instagram reel and post shape", () => {
    const shapes = [
      "https://www.instagram.com/reel/C9abcDEF/",
      "https://instagram.com/reels/C9abcDEF",
      "https://www.instagram.com/p/C9abcDEF/?igsh=tracking",
      "https://www.instagram.com/someuser/reel/C9abcDEF/",
      "instagram.com/reel/C9abcDEF",
    ];
    for (const shape of shapes) {
      const parsed = parseReferenceUrl(shape);
      expect(parsed, shape).toMatchObject({ kind: "instagram", shortcode: "C9abcDEF" });
    }
  });

  it("canonicalises to a stable reel url so the same reel is not imported twice under different links", () => {
    const withTracking = parseReferenceUrl("https://www.instagram.com/p/C9abcDEF/?igsh=abc123");
    const bare = parseReferenceUrl("https://instagram.com/reels/C9abcDEF");
    expect(withTracking).toMatchObject({ canonicalUrl: "https://www.instagram.com/reel/C9abcDEF/" });
    expect(bare).toMatchObject({ canonicalUrl: "https://www.instagram.com/reel/C9abcDEF/" });
  });

  it("reports TikTok as coming soon rather than spending a scraper call", () => {
    for (const url of ["https://www.tiktok.com/@user/video/7300000000000000000", "https://vm.tiktok.com/ZMabcdef/"]) {
      expect(parseReferenceUrl(url)).toEqual({ kind: "coming_soon", platform: "tiktok" });
    }
    expect(referencePlatformOf(parseReferenceUrl("https://www.tiktok.com/@user/video/1"))).toBe("tiktok");
  });

  it("rejects links that are not reels, and junk", () => {
    expect(parseReferenceUrl("https://www.instagram.com/someuser/").kind).toBe("unsupported");
    expect(parseReferenceUrl("https://youtube.com/watch?v=abc").kind).toBe("unsupported");
    expect(parseReferenceUrl("not a link at all").kind).toBe("unsupported");
    expect(parseReferenceUrl("   ").kind).toBe("unsupported");
  });

  it("does not mistake a path word for a shortcode", () => {
    expect(parseReferenceUrl("https://www.instagram.com/reel/").kind).toBe("unsupported");
  });
});
