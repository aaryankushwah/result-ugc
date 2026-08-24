import { describe, expect, it } from "vitest";
import { buildVideoVisibilityRequests, countVideosChanging, videoVisibilityBatchSize, videoVisibilityResultMessage, type VideoVisibilityTarget } from "./video-visibility";

function video(overrides: Partial<VideoVisibilityTarget> = {}): VideoVisibilityTarget {
  return { accountId: "orgacc_1", platform: "tiktok", platformAccountId: "acct-1", platformVideoId: "vid-1", included: true, ...overrides };
}

describe("video visibility requests", () => {
  it("sends nothing when every video is already in the requested state", () => {
    expect(buildVideoVisibilityRequests([video({ included: true })], true)).toEqual([]);
    expect(buildVideoVisibilityRequests([video({ included: false })], false)).toEqual([]);
    expect(buildVideoVisibilityRequests([], false)).toEqual([]);
  });

  it("excludes through the exclude endpoint with a reason and the Viral account id", () => {
    expect(buildVideoVisibilityRequests([video()], false)).toEqual([{
      url: "/api/videos/exclude",
      body: { reason: "warmup_unpaid", videos: [{ accountId: "orgacc_1", platform: "tiktok", platformAccountId: "acct-1", platformVideoId: "vid-1" }] },
    }]);
  });

  it("restores through the restore endpoint without the account id or a reason", () => {
    expect(buildVideoVisibilityRequests([video({ included: false })], true)).toEqual([{
      url: "/api/videos/restore",
      body: { videos: [{ accountId: "orgacc_1", platform: "tiktok", platformVideoId: "vid-1" }] },
    }]);
  });

  it("only moves the rows that need moving in a mixed selection", () => {
    const requests = buildVideoVisibilityRequests([
      video({ platformVideoId: "already-excluded", included: false }),
      video({ platformVideoId: "needs-excluding", included: true }),
    ], false);
    expect(requests).toHaveLength(1);
    expect((requests[0]!.body.videos as Array<{ platformVideoId: string }>).map((entry) => entry.platformVideoId)).toEqual(["needs-excluding"]);
  });

  it("splits a selection larger than the endpoint limit into batches", () => {
    const many = Array.from({ length: videoVisibilityBatchSize + 5 }, (_, index) => video({ platformVideoId: `vid-${index}` }));
    const requests = buildVideoVisibilityRequests(many, false);
    expect(requests).toHaveLength(2);
    expect((requests[0]!.body.videos as unknown[]).length).toBe(videoVisibilityBatchSize);
    expect((requests[1]!.body.videos as unknown[]).length).toBe(5);
  });

  it("counts and describes only the rows that change", () => {
    const mixed = [video({ included: true }), video({ platformVideoId: "vid-2", included: false })];
    expect(countVideosChanging(mixed, false)).toBe(1);
    expect(countVideosChanging(mixed, true)).toBe(1);
    expect(videoVisibilityResultMessage(1, false)).toBe("1 video excluded from Result totals.");
    expect(videoVisibilityResultMessage(3, true)).toBe("3 videos restored to Result totals.");
  });
});
