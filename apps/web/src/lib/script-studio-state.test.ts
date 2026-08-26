import { describe, expect, it } from "vitest";
import { filterScriptsByCategory, isPersistedCreatorId, mergeScriptAssignments, partitionScriptAssets, referencePlatformFromUrl, removeStudioScript, restoreStudioScript, unavailableScriptStudioData } from "./script-studio-state";

describe("script studio state", () => {
  it("filters the script bank by its persisted category", () => {
    const scripts = [
      { id: "script-a", category: "Uncategorized" },
      { id: "script-b", category: "Education" },
    ];

    expect(filterScriptsByCategory(scripts, "all")).toEqual(scripts);
    expect(filterScriptsByCategory(scripts, "Uncategorized")).toEqual([scripts[0]]);
    expect(filterScriptsByCategory(scripts, "Education")).toEqual([scripts[1]]);
  });

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

  it("never invents scripts when the Script Studio database is unavailable", () => {
    const creators = [{ id:"creator-1", name:"Real creator", username:null, avatarUrl:null, specialties:[], activeAssignments:0 }];
    const brand = { name:"Result", productDescription:"", audience:"", voice:[], bannedPhrases:[], proofPoints:[] };
    expect(unavailableScriptStudioData(creators, brand)).toEqual({
      sourceMode:"unavailable",
      failedNotifications:[],
      brand,
      creators,
      scripts:[],
    });
  });

  it("separates reference videos from editing resources", () => {
    const assets = [
      { id: "ref", label: "Winning hook", kind: "reference_video", sourceUrl: "https://example.com/ref", downloadUrl: null },
      { id: "audio", label: "Voiceover", kind: "audio", sourceUrl: "https://example.com/audio", downloadUrl: null },
      { id: "image", label: "Product shot", kind: "image", sourceUrl: "https://example.com/image", downloadUrl: null },
    ];
    expect(partitionScriptAssets(assets)).toEqual({ references: [assets[0]], resources: [assets[1], assets[2]] });
  });

  it("removes only the deleted script from the editor state", () => {
    const scripts = [{ id: "script-a", title: "A" }, { id: "script-b", title: "B" }];
    expect(removeStudioScript(scripts, "script-a")).toEqual([{ id: "script-b", title: "B" }]);
    expect(scripts).toHaveLength(2);
  });

  it("restores an optimistically deleted script at its original position", () => {
    const deleted = { id: "script-b", title: "B" };
    const current = [{ id: "script-a", title: "A" }, { id: "script-c", title: "C" }];
    expect(restoreStudioScript(current, deleted, 1)).toEqual([current[0], deleted, current[1]]);
    expect(restoreStudioScript([deleted], deleted, 0)).toEqual([deleted]);
  });
});
