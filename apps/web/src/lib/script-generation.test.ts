import { beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("ai", () => ({ generateObject }));
vi.mock("./ai-gateway", () => ({ hasGatewayCredentials: () => true }));

import {
  generateScript,
  SCRIPT_GENERATION_TIMEOUT_MS,
  SCRIPT_MODEL,
  scriptGenerationErrorFrom,
} from "./script-generation";

const input = {
  sections: [{
    id: "hook",
    label: "Hook",
    timecode: "0:00-0:06",
    delivery: "Talking head",
    copy: "Acme makes creator operations easier.",
    visualDirection: "Direct to camera",
    assetIds: [],
  }],
  brand: {
    name: "Result",
    productDescription: "A creator operations workspace.",
    audience: "Creator managers",
    voice: ["direct"],
    bannedPhrases: [],
    proofPoints: [],
  },
  referenceId: "reference-1",
  transcript: "Acme makes creator operations easier.",
};

describe("script generation runtime policy", () => {
  beforeEach(() => generateObject.mockReset());

  it("uses the fast Gateway model without retries and stays below Vercel's deadline", async () => {
    generateObject.mockResolvedValue({
      object: {
        sections: [{ id: "hook", copy: "Result makes creator operations easier." }],
        substitutions: [{ sectionId: "hook", from: "Acme", to: "Result" }],
      },
    });

    const result = await generateScript(input);

    expect(SCRIPT_MODEL).toBe("anthropic/claude-sonnet-4.6");
    expect(SCRIPT_GENERATION_TIMEOUT_MS).toBeLessThan(60_000);
    expect(generateObject).toHaveBeenCalledWith(expect.objectContaining({
      model: SCRIPT_MODEL,
      maxRetries: 0,
      abortSignal: expect.any(AbortSignal),
    }));
    expect(result.generation.model).toBe(SCRIPT_MODEL);
    expect(result.sections[0]?.copy).toBe("Result makes creator operations easier.");
  });

  it("turns a provider deadline into a useful retry message", () => {
    const error = scriptGenerationErrorFrom({
      name: "TimeoutError",
      message: "The operation was aborted",
    });

    expect(error.message).toBe("Generation took too long. Please try again.");
  });
});
