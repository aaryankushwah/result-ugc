import { describe, expect, it } from "vitest";
import { warmupDaysLeft, warmupDurationDays, warmupEndAt, warmupReminderDate } from "@result/domain";
import { buildWarmupCompletionMessage, buildWarmupDetailsEmbed, buildWarmupReminderMessage, type ActiveWarmup } from "../src/discord/warmups.js";

function warmup(overrides: Partial<ActiveWarmup> = {}): ActiveWarmup {
  return {
    id: "warmup-1",
    organizationId: "org-1",
    creatorId: "creator-1",
    displayName: "Jamie Creator",
    discordUserId: "123456789012345678",
    durationDays: 3,
    startedAt: new Date("2026-08-28T18:00:00.000Z"),
    endsAt: new Date("2026-08-31T00:00:00.000Z"),
    daysLeft: 3,
    lastReminderDate: "2026-08-28",
    ...overrides,
  };
}

describe("creator warmup countdown", () => {
  it("defaults to three UTC calendar days and decrements once per day", () => {
    const startedAt = new Date("2026-08-28T18:00:00.000Z");
    const endsAt = warmupEndAt(startedAt, warmupDurationDays(null));
    expect(endsAt.toISOString()).toBe("2026-08-31T00:00:00.000Z");
    expect(warmupDaysLeft(endsAt, startedAt)).toBe(3);
    expect(warmupDaysLeft(endsAt, new Date("2026-08-29T08:00:00.000Z"))).toBe(2);
    expect(warmupDaysLeft(endsAt, new Date("2026-08-30T23:59:00.000Z"))).toBe(1);
    expect(warmupDaysLeft(endsAt, new Date("2026-08-31T00:00:00.000Z"))).toBe(0);
    expect(warmupReminderDate(startedAt)).toBe("2026-08-28");
  });

  it("formats creator reminders with correct singular and plural days", () => {
    expect(buildWarmupReminderMessage(warmup())).toContain("**3 days left**");
    expect(buildWarmupReminderMessage(warmup({ daysLeft: 1 }))).toContain("**1 day left**");
    expect(buildWarmupCompletionMessage(warmup())).toContain("**3-day warmup** is complete");
  });

  it("formats the manager overview without pinging through free text", () => {
    const embed = buildWarmupDetailsEmbed([warmup(), warmup({ id: "warmup-2", displayName: "Alex", daysLeft: 1 })]).toJSON();
    expect(embed.title).toBe("Creator warmups");
    expect(embed.description).toContain("Jamie Creator");
    expect(embed.description).toContain("**1 day left**");
    expect(embed.footer?.text).toContain("2 active creators");
  });
});
