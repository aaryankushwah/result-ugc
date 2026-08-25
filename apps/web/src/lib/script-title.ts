/**
 * Reference titles are lifted from Instagram/TikTok captions, which are often
 * mostly hashtags. Strip them for display so the card shows the actual idea.
 * Falls back to the original when a title is nothing but hashtags.
 */
export function cleanScriptTitle(title: string): string {
  const stripped = title.replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, " ").replace(/\s+/g, " ").trim();
  return stripped || title.trim() || "Untitled script";
}
