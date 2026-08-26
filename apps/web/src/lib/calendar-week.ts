const DAY_MS = 24 * 60 * 60 * 1000;

export type CalendarWeek = {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
};

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** A stable Monday-to-Sunday UTC week. Offset 0 is this week; 1 is last week. */
export function calendarWeek(offset = 0, now = new Date()): CalendarWeek {
  const anchor = new Date(now);
  anchor.setUTCHours(0, 0, 0, 0);
  const daysSinceMonday = (anchor.getUTCDay() + 6) % 7;
  const start = new Date(anchor.getTime() - (daysSinceMonday + offset * 7) * DAY_MS);
  const end = new Date(start.getTime() + 6 * DAY_MS);
  return { start, end, startDate: dayKey(start), endDate: dayKey(end) };
}

export function calendarWeekLabel(week: CalendarWeek, includeWeekdays = true): string {
  const format = (value: Date) => value.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
    ...(includeWeekdays ? { weekday: "short" as const } : {}),
  });
  return `${format(week.start)} – ${format(week.end)}`;
}
