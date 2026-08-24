import { describe, expect, it } from "vitest";
import { canonicalUrlFor, parseReferenceUrl, referencePlatformOf } from "./reference-url";

describe("parseReferenceUrl — Instagram", () => {
  it("accepts every reel and post shape", () => {
    const shapes = [
      "https://www.instagram.com/reel/C9abcDEF/",
      "https://instagram.com/reels/C9abcDEF",
      "https://www.instagram.com/p/C9abcDEF/?igsh=tracking",
      "https://www.instagram.com/someuser/reel/C9abcDEF/",
      "instagram.com/reel/C9abcDEF",
    ];
    for (const shape of shapes) {
      expect(parseReferenceUrl(shape), shape).toMatchObject({ kind: "video", platform: "instagram", videoId: "C9abcDEF" });
    }
  });

  it("canonicalises so the same reel is not imported twice under different links", () => {
    expect(parseReferenceUrl("https://www.instagram.com/p/C9abcDEF/?igsh=abc")).toMatchObject({ canonicalUrl: "https://www.instagram.com/reel/C9abcDEF/" });
    expect(parseReferenceUrl("https://instagram.com/reels/C9abcDEF")).toMatchObject({ canonicalUrl: "https://www.instagram.com/reel/C9abcDEF/" });
  });

  it("rejects a profile link and a bare /reel/ path", () => {
    expect(parseReferenceUrl("https://www.instagram.com/someuser/").kind).toBe("unsupported");
    expect(parseReferenceUrl("https://www.instagram.com/reel/").kind).toBe("unsupported");
  });
});

describe("parseReferenceUrl — TikTok", () => {
  it("reads the numeric id from a full video link", () => {
    const shapes = [
      "https://www.tiktok.com/@denis.build/video/7676845771534191890",
      "https://tiktok.com/video/7676845771534191890",
      "https://m.tiktok.com/v/7676845771534191890.html",
      "https://www.tiktok.com/@user/video/7676845771534191890?is_from_webapp=1&sender_device=pc",
    ];
    for (const shape of shapes) {
      expect(parseReferenceUrl(shape), shape).toMatchObject({ kind: "video", platform: "tiktok", videoId: "7676845771534191890" });
    }
  });

  it("flags share links for expansion instead of guessing an id", () => {
    expect(parseReferenceUrl("https://vm.tiktok.com/ZMabcdef/")).toEqual({ kind: "short_link", platform: "tiktok", url: "https://vm.tiktok.com/ZMabcdef" });
    expect(parseReferenceUrl("https://vt.tiktok.com/ZSxyz123/")).toMatchObject({ kind: "short_link", platform: "tiktok" });
    expect(parseReferenceUrl("https://www.tiktok.com/t/ZTabc123/")).toMatchObject({ kind: "short_link", platform: "tiktok" });
  });

  it("reads the id from the username-less URL Viral's resolver returns", () => {
    // Viral expands share links to https://www.tiktok.com/@/video/<id> and reports
    // resolved:false when it cannot recover the username. The id is still valid.
    expect(parseReferenceUrl("https://www.tiktok.com/@/video/7477928299168304407"))
      .toMatchObject({ kind: "video", platform: "tiktok", videoId: "7477928299168304407" });
  });

  it("rejects a TikTok profile link and a non-numeric id", () => {
    expect(parseReferenceUrl("https://www.tiktok.com/@denis.build").kind).toBe("unsupported");
    expect(parseReferenceUrl("https://www.tiktok.com/@user/video/notanumber").kind).toBe("unsupported");
  });

  it("does not confuse a TikTok id with an Instagram shortcode", () => {
    const tiktok = parseReferenceUrl("https://www.tiktok.com/@u/video/7676845771534191890");
    const instagram = parseReferenceUrl("https://www.instagram.com/reel/C9abcDEF/");
    expect(referencePlatformOf(tiktok)).toBe("tiktok");
    expect(referencePlatformOf(instagram)).toBe("instagram");
  });
});

describe("parseReferenceUrl — rejections", () => {
  it("rejects other hosts and junk", () => {
    expect(parseReferenceUrl("https://youtube.com/watch?v=abc").kind).toBe("unsupported");
    expect(parseReferenceUrl("not a link at all").kind).toBe("unsupported");
    expect(parseReferenceUrl("   ").kind).toBe("unsupported");
    expect(referencePlatformOf(parseReferenceUrl("nonsense"))).toBeNull();
  });
});

describe("canonicalUrlFor", () => {
  it("builds the ids Viral's live lookup expects", () => {
    expect(canonicalUrlFor("instagram", "C9abcDEF")).toBe("https://www.instagram.com/reel/C9abcDEF/");
    expect(canonicalUrlFor("tiktok", "7676845771534191890")).toBe("https://www.tiktok.com/video/7676845771534191890");
  });
});
