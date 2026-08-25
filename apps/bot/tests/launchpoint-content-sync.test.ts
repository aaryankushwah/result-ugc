import { describe, expect, it } from "vitest";
import { launchpointPostKey } from "../src/discord/launchpoint-sync.js";

describe("Launchpoint content synchronization", () => {
  it("deduplicates cross-posts as one source creative", () => {
    expect(launchpointPostKey({ id: "instagram-1", crossPostGroupId: "source-1" })).toBe("source-1");
    expect(launchpointPostKey({ id: "tiktok-1", crossPostGroupId: "source-1" })).toBe("source-1");
    expect(launchpointPostKey({ id: "post-1" })).toBe("post-1");
    expect(launchpointPostKey({})).toBeNull();
  });
});
