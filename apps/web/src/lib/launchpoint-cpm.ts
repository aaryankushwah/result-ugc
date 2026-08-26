import type { LaunchpointAccountAnalytics, LaunchpointPayStructure } from "@result/db";

export type CreatorCpmMetrics = {
  realizedCpm: number | null;
  totalEarnings: number;
  totalViews: number;
  configuredCpmMin: number | null;
  configuredCpmMax: number | null;
};

export type CompanyConfiguredCpm = {
  configuredCpmMin: number | null;
  configuredCpmMax: number | null;
  maxCpmEarnable: number | null;
};

export function launchpointAccountKey(platform: string | null | undefined, handle: string | null | undefined): string | null {
  const normalizedPlatform = platform?.trim().toLowerCase();
  const normalizedHandle = handle?.trim().replace(/^@/, "").toLowerCase();
  return normalizedPlatform && normalizedHandle ? `${normalizedPlatform}:${normalizedHandle}` : null;
}

export function accountAnalyticsByIdentity(rows: LaunchpointAccountAnalytics[]): Map<string, LaunchpointAccountAnalytics> {
  const result = new Map<string, LaunchpointAccountAnalytics>();
  for (const row of rows) {
    const key = launchpointAccountKey(row.platform, row.handle);
    if (key) result.set(key, row);
  }
  return result;
}

export function creatorCpmMetrics(
  creatorId: string | null,
  accountRows: LaunchpointAccountAnalytics[],
  payStructures: LaunchpointPayStructure[],
): CreatorCpmMetrics {
  if (!creatorId) return { realizedCpm: null, totalEarnings: 0, totalViews: 0, configuredCpmMin: null, configuredCpmMax: null };
  const creatorAccounts = accountRows.filter((row) => row.contractorId === creatorId);
  const totalEarnings = creatorAccounts.reduce((sum, row) => sum + (row.totalEarnings ?? 0), 0);
  const totalViews = creatorAccounts.reduce((sum, row) => sum + (row.totalViews ?? 0), 0);
  const realizedCpm = totalViews > 0 && totalEarnings > 0 ? totalEarnings / totalViews * 1_000 : null;
  const configuredRates = payStructures
    .filter((row) => row.creatorId === creatorId && typeof row.money?.cpmCents === "number")
    .map((row) => row.money!.cpmCents! / 100);
  return {
    realizedCpm,
    totalEarnings,
    totalViews,
    configuredCpmMin: configuredRates.length ? Math.min(...configuredRates) : null,
    configuredCpmMax: configuredRates.length ? Math.max(...configuredRates) : null,
  };
}

export function companyConfiguredCpm(
  payStructures: LaunchpointPayStructure[],
  accountRows: LaunchpointAccountAnalytics[],
): CompanyConfiguredCpm {
  const trackedCreatorIds = new Set(accountRows.map((row) => row.contractorId).filter(Boolean));
  const trackedStructures = payStructures.filter((row) => trackedCreatorIds.has(row.creatorId));
  const rates = trackedStructures
    .map((row) => row.money?.cpmCents)
    .filter((value): value is number => typeof value === "number")
    .map((value) => value / 100);
  const caps = trackedStructures
    .map((row) => row.money?.maxCpmEarnableCents)
    .filter((value): value is number => typeof value === "number")
    .map((value) => value / 100);
  return {
    configuredCpmMin: rates.length ? Math.min(...rates) : null,
    configuredCpmMax: rates.length ? Math.max(...rates) : null,
    maxCpmEarnable: caps.length ? caps.reduce((sum, value) => sum + value, 0) : null,
  };
}

export function formatCpm(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export function formatConfiguredCpm(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null) return "—";
  return max != null && max !== min ? `${formatCpm(min)}–${formatCpm(max)}` : formatCpm(min);
}
