import type { StudioAsset, StudioScript } from "./script-studio-data";

export type StudioAssignment = StudioScript["assignments"][number];

export function isPersistedCreatorId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function mergeScriptAssignments(current: StudioAssignment[], incoming: StudioAssignment[]): StudioAssignment[] {
  const merged = new Map(current.map((assignment) => [assignment.creatorId, assignment]));
  for (const assignment of incoming) merged.set(assignment.creatorId, assignment);
  return Array.from(merged.values());
}

export function removeStudioScript<T extends { id: string }>(scripts: T[], scriptId: string): T[] {
  return scripts.filter((script) => script.id !== scriptId);
}

export function restoreStudioScript<T extends { id: string }>(scripts: T[], script: T, index: number): T[] {
  if (scripts.some((item) => item.id === script.id)) return scripts;
  const restored = [...scripts];
  restored.splice(Math.max(0, Math.min(index, restored.length)), 0, script);
  return restored;
}

export function referencePlatformFromUrl(url: string): string {
  const value = url.trim().toLowerCase();
  if (value.includes("tiktok.com")) return "tiktok";
  if (value.includes("youtube.com") || value.includes("youtu.be")) return "youtube";
  if (value.includes("facebook.com") || value.includes("fb.watch")) return "facebook";
  if (value.includes("instagram.com")) return "instagram";
  return "other";
}

export function partitionScriptAssets(assets: StudioAsset[]): { references: StudioAsset[]; resources: StudioAsset[] } {
  return {
    references: assets.filter((asset) => asset.kind === "reference_video"),
    resources: assets.filter((asset) => asset.kind !== "reference_video"),
  };
}
