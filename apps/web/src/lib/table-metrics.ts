import { calendarWeek } from "./calendar-week";

type PublishedRecord = { accountId: string; publishedAt: string | null };

type CreatorAccountRecord = {
  id: string;
  accounts: Array<{ id: string; posts: number; linkState: "suggested" | "confirmed" | "unlinked" }>;
};

export type PostActivityDay = {
  date: string;
  label: string;
  count: number;
};

export function calendarWeekPostActivity(
  videos: PublishedRecord[],
  accountIds: Iterable<string>,
  weekOffset = 0,
  now = new Date(),
): PostActivityDay[] {
  const includedAccounts = new Set(accountIds);
  const week = calendarWeek(weekOffset, now);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(week.start);
    date.setUTCDate(week.start.getUTCDate() + index);
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

export function creatorPostActivity(
  creators: CreatorAccountRecord[],
  videos: PublishedRecord[],
  now = new Date(),
) {
  return creators.map((creator) => {
    const connectedAccounts = creator.accounts.filter((account) => account.linkState === "confirmed");
    const accountIds = new Set(connectedAccounts.map((account) => account.id));
    const activity = calendarWeekPostActivity(videos, accountIds, 0, now);
    const activityDates = new Set(activity.map((day) => day.date));
    const completedAccountDays = new Set<string>();
    for (const video of videos) {
      const date = video.publishedAt?.slice(0, 10);
      if (date && accountIds.has(video.accountId) && activityDates.has(date)) completedAccountDays.add(`${video.accountId}:${date}`);
    }
    return {
      creatorId: creator.id,
      activity,
      posts: connectedAccounts.reduce((sum, account) => sum + account.posts, 0),
      postsThisWeek: activity.reduce((sum, day) => sum + day.count, 0),
      goalsHit: completedAccountDays.size,
      goalsTotal: connectedAccounts.length * activity.length,
    };
  });
}
