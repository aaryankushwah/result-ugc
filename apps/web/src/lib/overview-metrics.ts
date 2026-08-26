export const overviewMetricIds = [
  "active",
  "applicants",
  "accounts",
  "videos",
  "views",
  "cpm",
  "configuredCpm",
  "maxCpmEarnable",
  "averageViews",
  "likes",
  "comments",
  "shares",
  "bookmarks",
  "engagement",
  "attention",
] as const;

export type OverviewMetricId = (typeof overviewMetricIds)[number];

// Eight fits the rail at a readable card size. The rest stay one click away in the
// picker — packing all twelve in shrinks every card past the point of being scannable.
export const defaultOverviewMetricIds: OverviewMetricId[] = ["cpm", "configuredCpm", "maxCpmEarnable", "views", "comments", "likes", "shares", "videos"];

export function readOverviewMetricIds(value: string | null): OverviewMetricId[] {
  if (!value) return defaultOverviewMetricIds;
  const allowed = new Set<OverviewMetricId>(overviewMetricIds);
  const selected = [...new Set(value.split(",").filter((id): id is OverviewMetricId => allowed.has(id as OverviewMetricId)))];
  return selected.length ? selected : defaultOverviewMetricIds;
}

export function toggleOverviewMetric(ids: OverviewMetricId[], id: OverviewMetricId): OverviewMetricId[] {
  if (ids.includes(id)) return ids.length === 1 ? ids : ids.filter((item) => item !== id);
  return [...ids, id];
}
