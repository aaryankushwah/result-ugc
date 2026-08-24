type PublishedRecord = { accountId: string; publishedAt: string | null };

export type PostActivityDay = {
  date: string;
  label: string;
  count: number;
};

export function sevenDayPostActivity(
  videos: PublishedRecord[],
  accountIds: Iterable<string>,
  now = new Date(),
): PostActivityDay[] {
  const includedAccounts = new Set(accountIds);
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (6 - index));
    return {
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString("en-US", { weekday: "narrow", timeZone: "UTC" }),
      count: 0,
    };
  });
  const byDate = new Map(days.map((day) => [day.date, day]));
  for (const video of videos) {
    if (!video.publishedAt || !includedAccounts.has(video.accountId)) continue;
    const day = byDate.get(video.publishedAt.slice(0, 10));
    if (day) day.count += 1;
  }
  return days;
}
