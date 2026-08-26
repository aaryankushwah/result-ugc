export interface IssueDubLinkInput {
  creatorId: string;
  creatorName?: string;
  destinationUrl: string;
  campaign?: string;
  partnerId?: string;
  key?: string;
  externalId?: string;
}

interface IssuedDubLink {
  id: string;
  shortLink: string;
  destinationUrl: string;
  partnerId?: string;
  externalId: string;
  key?: string;
  clicks: number;
  leads: number;
  conversions: number;
  sales: number;
  saleAmount: number;
  lastClickedAt?: string;
}

export type DubLinkSnapshot = IssuedDubLink & { raw: Record<string, unknown> };

function configured(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function errorMessage(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (error?.message && typeof error.message === "string") return error.message;
  }
  return "Dub rejected the link request.";
}

function numeric(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function parseLink(payload: Record<string, unknown>, destinationUrl: string, externalId: string, partnerId?: string): DubLinkSnapshot {
  const shortLink = typeof payload.shortLink === "string"
    ? payload.shortLink
    : typeof payload.domain === "string" && typeof payload.key === "string"
      ? `https://${payload.domain}/${payload.key}`
      : undefined;
  if (typeof payload.id !== "string" || !shortLink) throw new Error("Dub returned an incomplete link response.");
  return {
    id: payload.id,
    shortLink,
    destinationUrl: typeof payload.url === "string" ? payload.url : destinationUrl,
    externalId: typeof payload.externalId === "string" ? payload.externalId : externalId,
    ...(typeof payload.key === "string" ? { key: payload.key } : {}),
    ...(partnerId ? { partnerId } : {}),
    clicks: numeric(payload, "clicks"),
    leads: numeric(payload, "leads"),
    conversions: numeric(payload, "conversions"),
    sales: numeric(payload, "sales"),
    saleAmount: numeric(payload, "saleAmount"),
    ...(typeof payload.lastClicked === "string" ? { lastClickedAt: payload.lastClicked } : {}),
    raw: payload,
  };
}

export function creatorDubExternalId(creatorId: string): string {
  return `result_creator_${creatorId}`;
}

export function creatorDubKey(name: string, creatorId: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "creator";
  return `${base}-${creatorId.replaceAll("-", "").slice(0, 6)}`;
}

export async function issueDubLink(input: IssueDubLinkInput): Promise<DubLinkSnapshot> {
  const token = configured("DUB_API_KEY");
  if (!token) throw new Error("Dub is not configured. Add DUB_API_KEY to the bot host's .env.");
  const partnerId = input.partnerId || configured("DUB_DEFAULT_PARTNER_ID");
  const campaign = input.campaign?.trim() || "UGC";
  const externalId = input.externalId ?? creatorDubExternalId(input.creatorId);
  const creatorLabel = input.creatorName ? `${input.creatorName} (${input.creatorId})` : input.creatorId;
  const body = partnerId
    ? { partnerId, url: input.destinationUrl, ...(input.key ? { key: input.key } : {}), comments: `Result UGC creator ${creatorLabel} · ${campaign}`, linkProps: { externalId } }
    : { url: input.destinationUrl, ...(input.key ? { key: input.key } : {}), externalId, comments: `Result UGC creator ${creatorLabel} · ${campaign}`, trackConversion: true };
  const response = await fetch(`https://api.dub.co/${partnerId ? "partners/links" : "links/upsert"}`, {
    method: partnerId ? "POST" : "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  if (!response.ok) throw new Error(errorMessage(payload));
  if (!payload) throw new Error("Dub returned an empty link response.");
  return parseLink(payload, input.destinationUrl, externalId, partnerId);
}

export async function getDubLink(linkId: string): Promise<DubLinkSnapshot> {
  const token = configured("DUB_API_KEY");
  if (!token) throw new Error("Dub is not configured. Add DUB_API_KEY to the bot host's .env.");
  const response = await fetch(`https://api.dub.co/links/info?linkId=${encodeURIComponent(linkId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  if (!response.ok) throw new Error(errorMessage(payload));
  if (!payload) throw new Error("Dub returned an empty link response.");
  return parseLink(payload, "", typeof payload.externalId === "string" ? payload.externalId : "");
}

export async function deleteDubLink(linkId: string): Promise<void> {
  const token = configured("DUB_API_KEY");
  if (!token) throw new Error("Dub is not configured. Add DUB_API_KEY to the bot host's .env.");
  const response = await fetch(`https://api.dub.co/links/${encodeURIComponent(linkId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(errorMessage(payload));
}
