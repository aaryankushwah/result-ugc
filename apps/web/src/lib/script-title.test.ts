import { describe, expect, it } from "vitest";
import { cleanScriptTitle } from "./script-title";

describe("cleanScriptTitle", () => {
  it("strips trailing hashtag spam from caption-derived titles", () => {
    expect(cleanScriptTitle("This is what pays my bills every month #ecom #claude #shopify #dropshipping #sidehustle"))
      .toBe("This is what pays my bills every month");
  });

  it("strips hashtags wherever they appear", () => {
    expect(cleanScriptTitle("#hustle Build a store #ecom today")).toBe("Build a store today");
  });

  it("keeps the original when the title is only hashtags", () => {
    expect(cleanScriptTitle("#ecom #shopify")).toBe("#ecom #shopify");
  });

  it("leaves ordinary titles untouched", () => {
    expect(cleanScriptTitle("One creator. One source of truth.")).toBe("One creator. One source of truth.");
  });

  it("handles empty and whitespace input", () => {
    expect(cleanScriptTitle("")).toBe("Untitled script");
    expect(cleanScriptTitle("   ")).toBe("Untitled script");
  });

  it("does not treat a bare # or a numeric anchor as a hashtag", () => {
    expect(cleanScriptTitle("Top 5 # of the year")).toBe("Top 5 # of the year");
  });
});
