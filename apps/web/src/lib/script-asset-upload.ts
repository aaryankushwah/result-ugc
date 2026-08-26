export const SCRIPT_ASSET_MAX_BYTES = 250 * 1024 * 1024;

export const SCRIPT_ASSET_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export type UploadableScriptAssetKind = "image" | "video";

export function scriptAssetKindFromContentType(contentType: string): UploadableScriptAssetKind | null {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  return null;
}

export function safeAssetFileName(value: string): string {
  const normalized = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/-+\./g, ".").replace(/^-|-$/g, "");
  return normalized.slice(0, 140) || "asset";
}

export function assetLabelFromFileName(value: string): string {
  return value.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Script asset";
}
