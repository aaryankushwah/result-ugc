import "dotenv/config";
import {
  activityEvents,
  closeDatabase,
  creatorAttributionLinks,
  creatorDiscord,
  creators,
  getDatabase,
  legacyGuildStates,
  organizations,
} from "@result/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import { persistDubLinkSnapshot } from "../src/discord/dub-sync.js";
import { deleteDubLink, updateDubLink } from "../src/integrations/dub.js";

type DiscordMessage = { id: string; timestamp: string; content: string; author?: { id?: string } };
type DubLink = { id: string; shortLink: string; externalId?: string | null; clicks?: number; leads?: number; conversions?: number; sales?: number; saleAmount?: number };
type ManualIssue = { messageId: string; issuedAt: string; discordUserId: string; desiredShortLink: string };

const apply = process.argv.includes("--apply");
const manualIssuePattern = /^New \*\*.+\*\* link for <@(\d+)>: (https:\/\/\S+)$/;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function discordGet<T>(path: string): Promise<T> {
  const response = await fetch(`https://discord.com/api/v10${path}`, { headers: { authorization: `Bot ${required("DISCORD_TOKEN")}` } });
  if (response.status === 429) {
    const body = await response.json() as { retry_after?: number };
    await new Promise((resolve) => setTimeout(resolve, Math.ceil((body.retry_after ?? 1) * 1_000)));
    return discordGet<T>(path);
  }
  if (!response.ok) throw new Error(`Discord ${path} failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function manualIssues(channelId: string, botId: string): Promise<ManualIssue[]> {
  const found: ManualIssue[] = [];
  let before: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ limit: "100", ...(before ? { before } : {}) });
    const messages = await discordGet<DiscordMessage[]>(`/channels/${channelId}/messages?${query}`);
    for (const message of messages) {
      if (message.author?.id !== botId) continue;
      const match = message.content.match(manualIssuePattern);
      if (!match) continue;
      found.push({ messageId: message.id, issuedAt: message.timestamp, discordUserId: match[1]!, desiredShortLink: match[2]! });
    }
    if (messages.length < 100) break;
    before = messages.at(-1)?.id ?? null;
  }
  return found;
}

async function listDubLinks(): Promise<DubLink[]> {
  const links: DubLink[] = [];
  let startingAfter: string | null = null;
  for (;;) {
    const query = new URLSearchParams({ pageSize: "100", showArchived: "true", ...(startingAfter ? { startingAfter } : {}) });
    const response = await fetch(`https://api.dub.co/links?${query}`, { headers: { authorization: `Bearer ${required("DUB_API_KEY")}` } });
    if (!response.ok) throw new Error(`Dub link listing failed (${response.status})`);
    const page = await response.json() as DubLink[];
    links.push(...page);
    if (page.length < 100) return links;
    startingAfter = page.at(-1)?.id ?? null;
  }
}

function linkKey(shortLink: string): string {
  const value = new URL(shortLink).pathname.replace(/^\/+|\/+$/g, "");
  if (!value) throw new Error(`Issued link has no key: ${shortLink}`);
  return value;
}

async function main(): Promise<void> {
  required("DATABASE_URL");
  required("DISCORD_TOKEN");
  required("DUB_API_KEY");
  const db = getDatabase();
  const organization = (await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (!organization) throw new Error("Result organization not found");
  const bot = await discordGet<{ id: string }>("/users/@me");
  const connections = await db.select({
    creatorId: creatorDiscord.creatorId,
    discordUserId: creatorDiscord.discordUserId,
    channelId: creatorDiscord.privateChannelId,
    creatorName: creators.displayName,
  }).from(creatorDiscord).innerJoin(creators, eq(creators.id, creatorDiscord.creatorId)).where(eq(creatorDiscord.organizationId, organization.id));
  const issued = (await Promise.all(connections.filter((connection) => connection.channelId).map((connection) => manualIssues(connection.channelId!, bot.id)))).flat();
  const latestByDiscordUser = new Map<string, ManualIssue>();
  for (const item of issued) {
    const current = latestByDiscordUser.get(item.discordUserId);
    if (!current || item.issuedAt > current.issuedAt) latestByDiscordUser.set(item.discordUserId, item);
  }
  const legacyRows = await db.select({ state: legacyGuildStates.state }).from(legacyGuildStates).where(eq(legacyGuildStates.organizationId, organization.id));
  const legacyProviderIdByDiscordUser = new Map<string, string>();
  for (const row of legacyRows) {
    const links = Array.isArray(row.state.creatorLinks) ? row.state.creatorLinks : [];
    for (const value of links) {
      if (!value || typeof value !== "object") continue;
      const record = value as Record<string, unknown>;
      if (typeof record.creatorId === "string" && typeof record.id === "string") legacyProviderIdByDiscordUser.set(record.creatorId, record.id);
    }
  }
  const dubLinks = await listDubLinks();
  const dubById = new Map(dubLinks.map((link) => [link.id, link]));
  const dubByExternalId = new Map(dubLinks.flatMap((link) => link.externalId ? [[link.externalId, link] as const] : []));
  const connectionByDiscordUser = new Map(connections.flatMap((connection) => connection.discordUserId ? [[connection.discordUserId, connection] as const] : []));
  const keep = [...latestByDiscordUser.values()].map((issue) => {
    const connection = connectionByDiscordUser.get(issue.discordUserId);
    if (!connection) throw new Error(`No canonical creator for Discord ${issue.discordUserId}`);
    const legacyId = legacyProviderIdByDiscordUser.get(issue.discordUserId);
    const link = legacyId ? dubById.get(legacyId) : dubByExternalId.get(`result_creator_${connection.creatorId}`);
    if (!link) throw new Error(`Could not match ${issue.desiredShortLink} to a current Dub link`);
    return { ...issue, ...connection, providerLinkId: link.id, currentShortLink: link.shortLink, desiredKey: linkKey(issue.desiredShortLink) };
  });
  const duplicateProviderIds = keep.filter((item, index) => keep.findIndex((candidate) => candidate.providerLinkId === item.providerLinkId) !== index);
  if (duplicateProviderIds.length) throw new Error(`Multiple Discord issues resolved to the same Dub link: ${duplicateProviderIds.map((item) => item.providerLinkId).join(", ")}`);
  const keepIds = new Set(keep.map((item) => item.providerLinkId));
  const remove = dubLinks.filter((link) => link.externalId?.startsWith("result_creator_") && !keepIds.has(link.id));

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    keep: keep.map((item) => ({ creator: item.creatorName, current: item.currentShortLink, restore: item.desiredShortLink, providerLinkId: item.providerLinkId })),
    remove: remove.map((link) => ({ providerLinkId: link.id, shortLink: link.shortLink, clicks: link.clicks ?? 0, conversions: link.conversions ?? 0, sales: link.sales ?? 0 })),
  }, null, 2));
  if (!apply) return;

  const restored = [];
  for (const item of keep) {
    restored.push({ item, snapshot: await updateDubLink(item.providerLinkId, {
      key: item.desiredKey,
      externalId: `result_creator_${item.creatorId}`,
      comments: `Result UGC creator ${item.creatorName} (${item.creatorId}) · issued via Discord /issue-link`,
    }) });
  }

  if (remove.length) {
    const rowsToRemove = await db.select({ providerLinkId: creatorAttributionLinks.providerLinkId, creatorId: creatorAttributionLinks.creatorId }).from(creatorAttributionLinks).where(and(eq(creatorAttributionLinks.organizationId, organization.id), inArray(creatorAttributionLinks.providerLinkId, remove.map((link) => link.id))));
    const creatorIdByProviderLink = new Map(rowsToRemove.map((row) => [row.providerLinkId, row.creatorId]));
    await db.insert(activityEvents).values(remove.map((link) => ({
      organizationId: organization.id,
      creatorId: creatorIdByProviderLink.get(link.id) ?? null,
      type: "attribution.automatic_link_removed",
      summary: "Removed a link created by the automatic attribution provisioner.",
      metadata: { providerLinkId: link.id, shortLink: link.shortLink, externalId: link.externalId, clicks: link.clicks ?? 0, leads: link.leads ?? 0, conversions: link.conversions ?? 0, sales: link.sales ?? 0, saleAmount: link.saleAmount ?? 0 },
    })));
    await db.delete(creatorAttributionLinks).where(and(eq(creatorAttributionLinks.organizationId, organization.id), inArray(creatorAttributionLinks.providerLinkId, remove.map((link) => link.id))));
  }
  for (const { item, snapshot } of restored) {
    await db.delete(creatorAttributionLinks).where(and(
      eq(creatorAttributionLinks.organizationId, organization.id),
      eq(creatorAttributionLinks.providerLinkId, item.providerLinkId),
      ne(creatorAttributionLinks.creatorId, item.creatorId),
    ));
    const current = (await db.select({ id: creatorAttributionLinks.id, providerLinkId: creatorAttributionLinks.providerLinkId }).from(creatorAttributionLinks).where(and(eq(creatorAttributionLinks.organizationId, organization.id), eq(creatorAttributionLinks.creatorId, item.creatorId))).limit(1))[0];
    if (current && current.providerLinkId !== item.providerLinkId) await db.delete(creatorAttributionLinks).where(eq(creatorAttributionLinks.id, current.id));
    await persistDubLinkSnapshot({ organizationId: organization.id, creatorId: item.creatorId, snapshot });
    await db.update(creatorAttributionLinks).set({ discordDeliveredAt: new Date(item.issuedAt), updatedAt: new Date() }).where(and(eq(creatorAttributionLinks.organizationId, organization.id), eq(creatorAttributionLinks.creatorId, item.creatorId)));
    await db.insert(activityEvents).values({ organizationId: organization.id, creatorId: item.creatorId, type: "attribution.link_reconciled", summary: "Restored the latest link explicitly issued through Discord.", metadata: { providerLinkId: item.providerLinkId, shortLink: item.desiredShortLink, discordMessageId: item.messageId } });
  }
  for (const link of remove) await deleteDubLink(link.id);
  console.log(`Reconciled ${restored.length} Discord-issued links and deleted ${remove.length} automatic links.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeDatabase());
