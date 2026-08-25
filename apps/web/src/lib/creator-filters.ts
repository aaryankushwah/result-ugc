import type { PortalCreator } from "./portal-types";

export type CreatorFilters = {
  lifecycle: PortalCreator["lifecycle"] | undefined;
  search: string;
  discord: string | null;
  provider: string | null;
  health: string | null;
};

export function creatorMatchesFilters(creator: PortalCreator, filters: CreatorFilters): boolean {
  const relationships = creator.relationships.map((relationship) => `${relationship.provider} ${relationship.program ?? ""}`).join(" ");
  const accounts = creator.accounts.map((account) => `${account.username} ${account.displayName} ${account.platform}`).join(" ");
  const haystack = `${creator.displayName} ${creator.discord.username ?? ""} ${creator.email ?? ""} ${relationships} ${accounts} ${creator.nextStep ?? ""}`.toLowerCase();

  if (creator.lifecycle !== filters.lifecycle || !haystack.includes(filters.search.toLowerCase())) return false;
  if (filters.discord === "connected" && creator.discord.state !== "connected") return false;
  if (filters.discord === "missing_access" && creator.discord.state === "connected") return false;
  if (filters.provider === "unlinked" && creator.relationships.length) return false;
  if (filters.provider && filters.provider !== "unlinked" && !creator.relationships.some((relationship) => relationship.provider === filters.provider)) return false;
  if (filters.health === "stale" && !["stale", "failed"].includes(creator.trackingState)) return false;
  if (filters.health && filters.health !== "stale" && creator.trackingState !== filters.health) return false;
  return true;
}
