import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchpointCreatorDirectory, resetLaunchpointCreatorDirectoryCache } from "../src/discord/interactions.js";

const originalKey = process.env.LAUNCHPOINT_API_KEY;

beforeEach(() => {
  process.env.LAUNCHPOINT_API_KEY = "test-key";
  resetLaunchpointCreatorDirectoryCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetLaunchpointCreatorDirectoryCache();
  if (originalKey === undefined) delete process.env.LAUNCHPOINT_API_KEY;
  else process.env.LAUNCHPOINT_API_KEY = originalKey;
});

describe("launchpointCreatorDirectory", () => {
  it("uses valid endpoint limits and merges post-only creators", async () => {
    const requests: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname.endsWith("/creators")) {
        return new Response(JSON.stringify({ data: [{ id: "creator-1", name: "Jimi" }] }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: [
        { creatorId: "creator-1", contractorName: "Jimi" },
        { creatorId: "creator-2", contractorName: "Eddie" },
      ] }), { status: 200 });
    }));

    await expect(launchpointCreatorDirectory()).resolves.toEqual([
      { id: "creator-1", name: "Jimi" },
      { id: "creator-2", name: "Eddie" },
    ]);
    expect(requests.find((url) => url.pathname.endsWith("/creators"))?.searchParams.get("limit")).toBe("100");
    expect(requests.find((url) => url.pathname.endsWith("/posts"))?.searchParams.get("limit")).toBe("500");
  });

  it("still returns creator records when the post endpoint fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("/posts")) return new Response(JSON.stringify({ error: "rate limited" }), { status: 429 });
      return new Response(JSON.stringify({ data: [{ id: "creator-1", name: "Jimi" }] }), { status: 200 });
    }));

    await expect(launchpointCreatorDirectory()).resolves.toEqual([{ id: "creator-1", name: "Jimi" }]);
  });
});
