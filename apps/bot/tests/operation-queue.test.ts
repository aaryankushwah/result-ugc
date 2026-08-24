import { describe, expect, it } from "vitest";
import { DISCORD_OPERATION_LOCK_TIMEOUT_MS, isDiscordOperationLockStale, staleDiscordOperationCutoff } from "../src/discord/operation-queue.js";

describe("Discord operation queue recovery", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");

  it("recovers operations whose worker lock outlived the timeout", () => {
    expect(isDiscordOperationLockStale(new Date(now.getTime() - DISCORD_OPERATION_LOCK_TIMEOUT_MS), now)).toBe(true);
    expect(isDiscordOperationLockStale(new Date(now.getTime() - DISCORD_OPERATION_LOCK_TIMEOUT_MS - 1), now)).toBe(true);
  });

  it("does not steal a lock from a worker that is still active", () => {
    expect(isDiscordOperationLockStale(new Date(now.getTime() - DISCORD_OPERATION_LOCK_TIMEOUT_MS + 1), now)).toBe(false);
    expect(isDiscordOperationLockStale(null, now)).toBe(false);
  });

  it("calculates a stable cutoff for the database recovery query", () => {
    expect(staleDiscordOperationCutoff(now).toISOString()).toBe("2026-08-24T11:55:00.000Z");
  });
});
