export interface IssueDubLinkInput {
  creatorId: string;
  creatorName?: string;
  destinationUrl: string;
  campaign?: string;
  partnerId?: string;
  key?: string;
}

export interface IssuedDubLink {
  id: string;
  shortLink: string;
  destinationUrl: string;
  partnerId?: string;
}

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

export async function issueDubLink(input: IssueDubLinkInput): Promise<IssuedDubLink> {
  const token = configured("DUB_API_KEY");
  if (!token) throw new Error("Dub is not configured. Add DUB_API_KEY to the bot host's .env.");
  const partnerId = input.partnerId || configured("DUB_DEFAULT_PARTNER_ID");
  const campaign = input.campaign?.trim() || "UGC";
  const externalId = `discord_${input.creatorId}_${Date.now()}`;
  const creatorLabel = input.creatorName ? `${input.creatorName} (${input.creatorId})` : input.creatorId;
  const body = partnerId
    ? { partnerId, url: input.destinationUrl, ...(input.key ? { key: input.key } : {}), comments: `Result UGC creator ${creatorLabel} · ${campaign}`, linkProps: { externalId } }
    : { url: input.destinationUrl, ...(input.key ? { key: input.key } : {}), externalId, comments: `Result UGC creator ${creatorLabel} · ${campaign}`, trackConversion: true };
  const response = await fetch(`https://api.dub.co/${partnerId ? "partners/links" : "links"}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => undefined)) as Record<string, unknown> | undefined;
  if (!response.ok) throw new Error(errorMessage(payload));
  const shortLink = typeof payload?.shortLink === "string"
    ? payload.shortLink
    : typeof payload?.domain === "string" && typeof payload?.key === "string"
      ? `https://${payload.domain}/${payload.key}`
      : undefined;
  if (typeof payload?.id !== "string" || !shortLink) throw new Error("Dub returned an incomplete link response.");
  return { id: payload.id, shortLink, destinationUrl: input.destinationUrl, ...(partnerId ? { partnerId } : {}) };
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
