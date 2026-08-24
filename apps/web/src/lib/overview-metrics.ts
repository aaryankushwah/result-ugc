export const overviewMetricIds = [
  "active",
  "applicants",
  "accounts",
  "videos",
  "views",
  "averageViews",
  "likes",
  "comments",
  "shares",
  "bookmarks",
  "engagement",
  "attention",
] as const;

export type OverviewMetricId = (typeof overviewMetricIds)[number];

export const defaultOverviewMetricIds: OverviewMetricId[] = ["views", "engagement", "likes", "comments", "shares", "videos"];

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
