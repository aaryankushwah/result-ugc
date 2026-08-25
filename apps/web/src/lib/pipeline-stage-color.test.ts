import { describe, expect, it } from "vitest";
import { ditherColorForStage, PIPELINE_STAGES } from "./pipeline-stage-color";

describe("ditherColorForStage", () => {
  it("gives every pipeline stage its own colour", () => {
    const colors = PIPELINE_STAGES.map(ditherColorForStage);
    expect(new Set(colors).size).toBe(PIPELINE_STAGES.length);
  });

  it("matches the stage hues used by the columns", () => {
    expect(ditherColorForStage("not_started")).toBe("grey");
    expect(ditherColorForStage("testing")).toBe("purple");
    expect(ditherColorForStage("iterate")).toBe("orange");
    expect(ditherColorForStage("winner")).toBe("green");
    expect(ditherColorForStage("retired")).toBe("red");
  });

  it("falls back to grey for an unknown stage rather than throwing", () => {
    expect(ditherColorForStage("something_new")).toBe("grey");
    expect(ditherColorForStage("")).toBe("grey");
  });
});
