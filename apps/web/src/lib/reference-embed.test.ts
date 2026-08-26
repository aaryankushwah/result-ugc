import { describe, expect, it } from "vitest";
import { referenceEmbedTarget } from "./reference-embed";

describe("reference embeds", () => {
  it("converts supported social links to privacy-conscious players", () => {
    expect(referenceEmbedTarget("https://youtu.be/abc123")?.url).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(referenceEmbedTarget("https://www.instagram.com/reel/ABC123/")?.url).toBe("https://www.instagram.com/reel/ABC123/embed/");
    expect(referenceEmbedTarget("https://www.tiktok.com/@result/video/123456")?.url).toBe("https://www.tiktok.com/player/v1/123456");
  });

  it("falls back when a URL has no safe inline player", () => {
    expect(referenceEmbedTarget("https://example.com/reference")).toBeNull();
  });
});
