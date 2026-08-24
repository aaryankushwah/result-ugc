export type CallTimezone = "est" | "pst" | "ist";

export const CALL_TIMEZONES: Record<CallTimezone, { label: string; zone: string }> = {
  est: { label: "Eastern (EST/EDT)", zone: "America/New_York" },
  pst: { label: "Pacific (PST/PDT)", zone: "America/Los_Angeles" },
  ist: { label: "India (IST)", zone: "Asia/Kolkata" },
};

export interface CallSlot {
  id: string;
  startsAt: string;
}

function parts(date: Date, timeZone: string): Record<string, number> {
  const entries = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(entries.filter((entry) => entry.type !== "literal").map((entry) => [entry.type, Number(entry.value)]));
}

export function localTimeToUtc(date: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = localAsUtc;
  for (let i = 0; i < 3; i += 1) {
    const current = parts(new Date(guess), timeZone);
    const renderedAsUtc = Date.UTC(current.year!, current.month! - 1, current.day!, current.hour!, current.minute!, current.second!);
    guess += localAsUtc - renderedAsUtc;
  }
  return new Date(guess);
}

export function formatSlot(date: Date | string, timezone: CallTimezone): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const formatted = new Intl.DateTimeFormat("en-US", {
    timeZone: CALL_TIMEZONES[timezone].zone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(value);
  return formatted;
}

export function dateLabel(date: string, timezone: CallTimezone): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: CALL_TIMEZONES[timezone].zone, weekday: "short", month: "short", day: "numeric" }).format(new Date(`${date}T12:00:00Z`));
}

export function nextMondayUtc(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const days = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return next.toISOString().slice(0, 10);
}

export function currentMondayUtc(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
  return monday.toISOString().slice(0, 10);
}

export function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

export function generateCallSlots(weekStart: string, timezone: CallTimezone, durationMinutes = 30): CallSlot[] {
  const [year, month, day] = weekStart.split("-").map(Number) as [number, number, number];
  const slots: CallSlot[] = [];
  for (let offset = 0; offset < 5; offset += 1) {
    const current = new Date(Date.UTC(year, month - 1, day + offset));
    const date = current.toISOString().slice(0, 10);
    for (let minutes = 11 * 60; minutes <= 13 * 60 - durationMinutes; minutes += 30) {
      const startsAt = localTimeToUtc(date, Math.floor(minutes / 60), minutes % 60, CALL_TIMEZONES[timezone].zone);
      slots.push({ id: `${date}-${String(minutes).padStart(4, "0")}`, startsAt: startsAt.toISOString() });
    }
  }
  return slots;
}
