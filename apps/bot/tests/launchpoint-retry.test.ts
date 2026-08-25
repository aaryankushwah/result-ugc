import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchpointGet } from "../src/integrations/launchpoint.js";

const originalKey = process.env.LAUNCHPOINT_API_KEY;

beforeEach(() => { process.env.LAUNCHPOINT_API_KEY = "test-key"; });
afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.LAUNCHPOINT_API_KEY;
  else process.env.LAUNCHPOINT_API_KEY = originalKey;
});

describe("Launchpoint request recovery", () => {
  it("retries rate limits and returns the successful response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "slow down" }), { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: "creator-1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(launchpointGet("/creators", {}, 100, 0)).resolves.toEqual({ data: [{ id: "creator-1" }] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries transient network failures", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("socket reset"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(launchpointGet("/posts", {}, 100, 0)).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
