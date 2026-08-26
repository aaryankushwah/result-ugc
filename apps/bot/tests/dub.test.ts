import { afterEach, describe, expect, it, vi } from "vitest";
import { creatorDubExternalId, creatorDubKey, getDubLink, issueDubLink, updateDubLink } from "../src/integrations/dub.js";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.DUB_API_KEY;
  delete process.env.DUB_DEFAULT_PARTNER_ID;
});

describe("Dub attribution links", () => {
  it("uses stable creator identifiers and keys", () => {
    expect(creatorDubExternalId("44e2-creator")).toBe("result_creator_44e2-creator");
    expect(creatorDubKey("Jimi Zhao!", "12345678-abcd")).toBe("jimi-zhao-123456");
  });

  it("creates a conversion-tracked link only when Discord requests one", async () => {
    process.env.DUB_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "link_1",
      domain: "result.link",
      key: "jimi-123456",
      url: "https://result.dev",
      externalId: "result_creator_creator-1",
      clicks: 17,
      leads: 4,
      conversions: 2,
      sales: 1,
      saleAmount: 4900,
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const link = await issueDubLink({ creatorId: "creator-1", creatorName: "Jimi", destinationUrl: "https://result.dev", key: "jimi-123456" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.dub.co/links");
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(options.method).toBe("POST");
    expect(JSON.parse(String(options.body))).toMatchObject({ externalId: "result_creator_creator-1", trackConversion: true });
    expect(link).toMatchObject({ id: "link_1", shortLink: "https://result.link/jimi-123456", clicks: 17, conversions: 2, saleAmount: 4900 });
  });

  it("normalizes omitted counters from Dub to zero", async () => {
    process.env.DUB_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "link_1", shortLink: "https://result.link/jimi", url: "https://result.dev", externalId: "result_creator_1", clicks: 8,
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(getDubLink("link_1")).resolves.toMatchObject({ clicks: 8, leads: 0, conversions: 0, sales: 0, saleAmount: 0 });
  });

  it("restores an issued link key without creating another link", async () => {
    process.env.DUB_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: "link_1", shortLink: "https://go.result.dev/jimizhao", url: "https://result.dev", key: "jimizhao", externalId: "result_creator_1",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await updateDubLink("link_1", { key: "jimizhao", externalId: "result_creator_1", comments: "Issued via Discord" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.dub.co/links/link_1");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
  });
});
