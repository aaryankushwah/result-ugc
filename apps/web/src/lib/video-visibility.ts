import type { PortalVideo } from "@/lib/portal-types";

/** The exclude/restore endpoints accept at most 100 videos per call. */
export const videoVisibilityBatchSize = 100;

export type VideoVisibilityTarget = Pick<PortalVideo, "accountId" | "platform" | "platformAccountId" | "platformVideoId" | "included">;

export type VideoVisibilityRequest = { url: string; body: Record<string, unknown> };

/**
 * Turn a visibility change into the calls that actually have to happen.
 *
 * Videos already in the requested state are dropped, so a mixed selection only
 * moves the rows that need moving and a no-op selection sends nothing. Exclusion
 * and restoration are different endpoints with different payloads: exclusion
 * needs the Viral account id and a reason, restoration does not.
 */
export function buildVideoVisibilityRequests(videos: VideoVisibilityTarget[], included: boolean): VideoVisibilityRequest[] {
  const changing = videos.filter((video) => video.included !== included);
  const requests: VideoVisibilityRequest[] = [];
  for (let index = 0; index < changing.length; index += videoVisibilityBatchSize) {
    const batch = changing.slice(index, index + videoVisibilityBatchSize);
    requests.push(included
      ? { url: "/api/videos/restore", body: { videos: batch.map(({ accountId, platform, platformVideoId }) => ({ accountId, platform, platformVideoId })) } }
      : { url: "/api/videos/exclude", body: { reason: "warmup_unpaid", videos: batch.map(({ accountId, platform, platformAccountId, platformVideoId }) => ({ accountId, platform, platformAccountId, platformVideoId })) } });
  }
  return requests;
}

export function countVideosChanging(videos: VideoVisibilityTarget[], included: boolean): number {
  return videos.filter((video) => video.included !== included).length;
}

export function videoVisibilityResultMessage(count: number, included: boolean): string {
  const noun = `${count} video${count === 1 ? "" : "s"}`;
  return included ? `${noun} restored to Result totals.` : `${noun} excluded from Result totals.`;
}

export function videoVisibilityFailureMessage(included: boolean): string {
  return included ? "Restoration failed. The videos remain excluded." : "Exclusion failed. Nothing was hidden.";
}
