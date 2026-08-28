import { describe, expect, it } from "vitest";
import { syncCompletionState } from "./sync-state";

describe("sync completion state", () => {
  it("marks a partial provider failure as degraded", () => {
    expect(syncCompletionState("provider rate limit")).toBe("degraded");
  });

  it("marks a complete refresh as succeeded", () => {
    expect(syncCompletionState(null)).toBe("succeeded");
  });
});
