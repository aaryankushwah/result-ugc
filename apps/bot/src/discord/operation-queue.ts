export const DISCORD_OPERATION_LOCK_TIMEOUT_MS = 5 * 60 * 1_000;

export function staleDiscordOperationCutoff(now = new Date()): Date {
  return new Date(now.getTime() - DISCORD_OPERATION_LOCK_TIMEOUT_MS);
}

export function isDiscordOperationLockStale(lockedAt: Date | null, now = new Date()): boolean {
  return Boolean(lockedAt && lockedAt.getTime() <= staleDiscordOperationCutoff(now).getTime());
}
