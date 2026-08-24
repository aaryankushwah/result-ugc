import { describe, expect, it } from "vitest";
import { buildBrandBlock, buildGenerationPrompt, isBrandContextUsable, SCRIPT_SYSTEM_PROMPT, type BrandContext } from "./script-prompt";

const brand: BrandContext = {
  name: "Result",
  productDescription: "One workspace for UGC creator programs.",
  audience: "UGC managers",
  voice: ["direct", "plain-spoken"],
  bannedPhrases: ["revolutionary", "game-changing"],
  proofPoints: ["Scripts, creators and approvals in one place"],
};

describe("script prompt", () => {
  it("instructs the model to preserve rather than rewrite", () => {
    expect(SCRIPT_SYSTEM_PROMPT).toMatch(/change as little as humanly possible/i);
    expect(SCRIPT_SYSTEM_PROMPT).toMatch(/verbatim/i);
    expect(SCRIPT_SYSTEM_PROMPT).toMatch(/Never add new sentences/i);
  });

  it("carries every brand field the generator depends on", () => {
    const block = buildBrandBlock(brand);
    expect(block).toContain("Result");
    expect(block).toContain("One workspace for UGC creator programs.");
    expect(block).toContain("UGC managers");
    expect(block).toContain("direct, plain-spoken");
    expect(block).toContain("Scripts, creators and approvals in one place");
    expect(block).toContain("revolutionary, game-changing");
  });

  it("omits optional brand lines when they are empty", () => {
    const block = buildBrandBlock({ ...brand, voice: [], bannedPhrases: [], proofPoints: [] });
    expect(block).not.toMatch(/Voice:/);
    expect(block).not.toMatch(/Never use these phrases/);
    expect(block).not.toMatch(/Approved proof points/);
  });

  it("labels each section with its id so output can be mapped back in order", () => {
    const prompt = buildGenerationPrompt(brand, [
      { id: "hook", label: "Hook", copy: "Stop scrolling." },
      { id: "cta", label: "CTA", copy: "Go to acme.com." },
    ]);
    expect(prompt).toContain("[hook] Hook\nStop scrolling.");
    expect(prompt).toContain("[cta] CTA\nGo to acme.com.");
    expect(prompt.indexOf("[hook]")).toBeLessThan(prompt.indexOf("[cta]"));
  });

  it("requires a name and a product description before generating", () => {
    expect(isBrandContextUsable(brand)).toBe(true);
    expect(isBrandContextUsable({ ...brand, name: "  " })).toBe(false);
    expect(isBrandContextUsable({ ...brand, productDescription: "" })).toBe(false);
  });
});
