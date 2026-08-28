import { describe, expect, it } from "vitest";
import { creatorsInWarmup, warmupSummary } from "./warmup";

const creators = [
  { displayName: "Three days", source: "result" as const, warmup: { id: "3", state: "active" as const, durationDays: 3, daysLeft: 3, startedAt: "2026-08-28T00:00:00Z", endsAt: "2026-08-31T00:00:00Z", lastReminderDate: null } },
  { displayName: "One day", source: "result" as const, warmup: { id: "1", state: "active" as const, durationDays: 3, daysLeft: 1, startedAt: "2026-08-26T00:00:00Z", endsAt: "2026-08-29T00:00:00Z", lastReminderDate: null } },
  { displayName: "Finished", source: "result" as const, warmup: null },
  { displayName: "Candidate", source: "viral_candidate" as const, warmup: { id: "candidate", state: "active" as const, durationDays: 3, daysLeft: 2, startedAt: "2026-08-27T00:00:00Z", endsAt: "2026-08-30T00:00:00Z", lastReminderDate: null } },
];

describe("warmup manager roster", () => {
  it("shows only canonical active warmups ordered by urgency", () => {
    expect(creatorsInWarmup(creators).map((creator) => creator.displayName)).toEqual(["One day", "Three days"]);
  });

  it("summarizes active, ending-soon, and average days", () => {
    expect(warmupSummary(creators)).toEqual({ active: 2, endingSoon: 1, averageDaysLeft: 2 });
  });
});
