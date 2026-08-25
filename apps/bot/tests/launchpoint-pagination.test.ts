import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchpointList } from "../src/integrations/launchpoint.js";

const originalKey = process.env.LAUNCHPOINT_API_KEY;

beforeEach(() => {
  process.env.LAUNCHPOINT_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalKey === undefined) delete process.env.LAUNCHPOINT_API_KEY;
  else process.env.LAUNCHPOINT_API_KEY = originalKey;
});

describe("launchpointList", () => {
  it("uses the endpoint limit and collects every creator page", async () => {
    const requests: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      requests.push(url);
      const page = Number(url.searchParams.get("page"));
      const data = page === 1
        ? Array.from({ length: 100 }, (_, index) => ({ id: `creator-${index}` }))
        : [{ id: "creator-100" }];
      return new Response(JSON.stringify({ data }), { status: 200 });
    }));

    const rows = await launchpointList<{ id: string }>("/creators");

    expect(rows).toHaveLength(101);
    expect(requests).toHaveLength(2);
    expect(requests.map((url) => url.searchParams.get("limit"))).toEqual(["100", "100"]);
    expect(requests.map((url) => url.searchParams.get("page"))).toEqual(["1", "2"]);
  });

  it("uses the larger post-page limit and stops at reported total pages", async () => {
    const requests: URL[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: URL | RequestInfo) => {
      const url = new URL(String(input));
      requests.push(url);
      return new Response(JSON.stringify({
        data: Array.from({ length: 500 }, (_, index) => ({ id: `post-${index}` })),
        totalPages: 1,
      }), { status: 200 });
    }));

    const rows = await launchpointList<{ id: string }>("/posts", { status: "approved" });

    expect(rows).toHaveLength(500);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.searchParams.get("limit")).toBe("500");
    expect(requests[0]?.searchParams.get("status")).toBe("approved");
  });
});
