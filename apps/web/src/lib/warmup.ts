import type { PortalCreator } from "./portal-types";

type WarmupCreator = Pick<PortalCreator, "displayName" | "source" | "warmup">;

export function creatorsInWarmup<T extends WarmupCreator>(creators: readonly T[]): T[] {
  return creators
    .filter((creator) => creator.source === "result" && creator.warmup?.state === "active" && creator.warmup.daysLeft > 0)
    .sort((left, right) => left.warmup!.daysLeft - right.warmup!.daysLeft || left.displayName.localeCompare(right.displayName));
}

export function warmupSummary(creators: readonly WarmupCreator[]): { active: number; endingSoon: number; averageDaysLeft: number } {
  const active = creatorsInWarmup(creators);
  return {
    active: active.length,
    endingSoon: active.filter((creator) => creator.warmup!.daysLeft === 1).length,
    averageDaysLeft: active.length ? Math.round(active.reduce((total, creator) => total + creator.warmup!.daysLeft, 0) / active.length) : 0,
  };
}
