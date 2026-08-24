import { describe, expect, it } from "vitest";
import { isPersistedCreatorId, mergeScriptAssignments, partitionScriptAssets, referencePlatformFromUrl } from "./script-studio-state";

describe("script studio state", () => {
  it("keeps existing creator assignments when another creator is added", () => {
    const current = [{ id: "old", creatorId: "creator-a", creatorName: "A", state: "assigned", dueAt: null }];
    const incoming = [{ id: "new", creatorId: "creator-b", creatorName: "B", state: "assigned", dueAt: null }];
    expect(mergeScriptAssignments(current, incoming).map((assignment) => assignment.creatorId)).toEqual(["creator-a", "creator-b"]);
  });

  it("replaces the visible state for a creator returned by the server", () => {
    const current = [{ id: "old", creatorId: "creator-a", creatorName: "A", state: "viewed", dueAt: null }];
    const incoming = [{ id: "new", creatorId: "creator-a", creatorName: "A", state: "assigned", dueAt: "2026-08-30T12:00:00.000Z" }];
    expect(mergeScriptAssignments(current, incoming)).toEqual(incoming);
  });

  it("detects the platform represented by a social video URL", () => {
    expect(referencePlatformFromUrl("https://www.instagram.com/reel/abc")).toBe("instagram");
    expect(referencePlatformFromUrl("https://www.tiktok.com/@creator/video/1")).toBe("tiktok");
    expect(referencePlatformFromUrl("https://youtu.be/example")).toBe("youtube");
    expect(referencePlatformFromUrl("")).toBe("other");
  });

  it("keeps preview and unmatched social candidates out of assignment targets", () => {
    expect(isPersistedCreatorId("afbb8360-0b8c-4b04-95e8-d6533191b6ac")).toBe(true);
    expect(isPersistedCreatorId("viral-orgacc_123")).toBe(false);
  });

  it("separates reference videos from editing resources", () => {
    const assets = [
      { id: "ref", label: "Winning hook", kind: "reference_video", sourceUrl: "https://example.com/ref", downloadUrl: null },
      { id: "audio", label: "Voiceover", kind: "audio", sourceUrl: "https://example.com/audio", downloadUrl: null },
      { id: "image", label: "Product shot", kind: "image", sourceUrl: "https://example.com/image", downloadUrl: null },
    ];
    expect(partitionScriptAssets(assets)).toEqual({ references: [assets[0]], resources: [assets[1], assets[2]] });
  });
});
