import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import type { ProviderCreator, ProviderRelationship, RelationshipState } from "@result/domain";
import * as schema from "./schema.js";

export * from "./schema.js";

export type ResultDatabase = ReturnType<typeof drizzle<typeof schema>>;

let connection: ReturnType<typeof postgres> | undefined;
let database: ResultDatabase | undefined;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDatabase(): ResultDatabase {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!connection) {
    connection = postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: Number(process.env.DATABASE_POOL_SIZE ?? 5),
      idle_timeout: 20,
      connect_timeout: 15,
    });
    database = drizzle(connection, { schema });
  }
  return database as ResultDatabase;
}

export async function closeDatabase(): Promise<void> {
  if (connection) await connection.end({ timeout: 5 });
  connection = undefined;
  database = undefined;
}

export function creatorIdentityKey(value: string | null | undefined): string | null {
  const normalized = value?.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  return normalized.length >= 3 ? normalized : null;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Rebuilds the cross-provider identity suggestions around canonical Result creators.
 * Confirmed manager mappings are never changed. Exact matches remain suggestions
 * until a manager confirms ownership in the portal.
 */
export async function reconcileCreatorAccountLinks(organizationId: string): Promise<number> {
  const db = getDatabase();
  const [creatorRows, discordRows, relationshipRows, accountRows] = await Promise.all([
    db.select({ id: schema.creators.id, displayName: schema.creators.displayName, email: schema.creators.email }).from(schema.creators).where(eq(schema.creators.organizationId, organizationId)),
    db.select({ creatorId: schema.creatorDiscord.creatorId, username: schema.creatorDiscord.username, displayName: schema.creatorDiscord.displayName }).from(schema.creatorDiscord).where(eq(schema.creatorDiscord.organizationId, organizationId)),
    db.select({ creatorId: schema.signingRelationships.creatorId, provider: schema.signingRelationships.provider, raw: schema.signingRelationships.raw }).from(schema.signingRelationships).where(eq(schema.signingRelationships.organizationId, organizationId)),
    db.select().from(schema.socialAccounts).where(eq(schema.socialAccounts.organizationId, organizationId)),
  ]);

  const creatorIdsByKey = new Map<string, Set<string>>();
  const addKey = (value: string | null | undefined, creatorId: string) => {
    const key = creatorIdentityKey(value);
    if (!key) return;
    const ids = creatorIdsByKey.get(key) ?? new Set<string>();
    ids.add(creatorId);
    creatorIdsByKey.set(key, ids);
  };

  for (const creator of creatorRows) {
    addKey(creator.displayName, creator.id);
    addKey(creator.email, creator.id);
  }
  for (const connection of discordRows) {
    addKey(connection.username, connection.creatorId);
    addKey(connection.displayName, connection.creatorId);
  }
  for (const relationship of relationshipRows) {
    const raw = objectValue(relationship.raw);
    const providerCreator = objectValue(raw?.creator);
    addKey(stringValue(providerCreator?.displayName), relationship.creatorId);
    addKey(stringValue(providerCreator?.name), relationship.creatorId);
    addKey(stringValue(providerCreator?.username), relationship.creatorId);
    addKey(stringValue(providerCreator?.email), relationship.creatorId);
    const socialIdentities = Array.isArray(raw?.socialIdentities) ? raw.socialIdentities : [];
    for (const identity of socialIdentities) {
      const record = objectValue(identity);
      addKey(stringValue(record?.username), relationship.creatorId);
      addKey(stringValue(record?.displayName), relationship.creatorId);
    }
  }

  let changed = 0;
  for (const account of accountRows) {
    if (account.linkState === "confirmed" || account.creatorId) continue;
    const candidates = new Set<string>();
    for (const value of [account.username, account.displayName]) {
      const key = creatorIdentityKey(value);
      if (!key) continue;
      for (const creatorId of creatorIdsByKey.get(key) ?? []) candidates.add(creatorId);
    }
    const suggestedCreatorId = candidates.size === 1 ? [...candidates][0]! : null;
    const nextState = suggestedCreatorId ? "suggested" as const : "unlinked" as const;
    if (account.suggestedCreatorId === suggestedCreatorId && account.linkState === nextState) continue;
    await db.update(schema.socialAccounts).set({ suggestedCreatorId, linkState: nextState, linkConfidence: suggestedCreatorId ? 1 : null, updatedAt: new Date() }).where(eq(schema.socialAccounts.id, account.id));
    if (suggestedCreatorId) {
      await db.insert(schema.activityEvents).values({
        organizationId,
        creatorId: suggestedCreatorId,
        type: "account.match_suggested",
        summary: `@${account.username ?? "account"} exactly matched this creator across Result, Discord, or Launchpoint.`,
        metadata: { viralOrgAccountId: account.viralOrgAccountId, platform: account.platform, confidence: 1 },
      });
    }
    changed += 1;
  }
  return changed;
}

export type LaunchpointRelationshipInput = ProviderRelationship & { creatorExternalId: string };
export type LaunchpointSocialIdentityInput = { creatorExternalId: string; platform: string; username: string; url?: string | null };

function relationshipPriority(state: RelationshipState): number {
  return state === "signed_active" ? 5 : state === "expiring" ? 4 : state === "signed_upcoming" ? 3 : state === "pending" ? 2 : state === "inactive" ? 1 : 0;
}

/**
 * Upserts a complete Launchpoint directory into the canonical Result creator graph.
 * Existing provider mappings always win. New records exact-match email/username/name,
 * then seed a reviewable Result creator only when no canonical record exists.
 */
export async function reconcileLaunchpointDataset(input: {
  organizationId: string;
  creators: ProviderCreator[];
  relationships: LaunchpointRelationshipInput[];
  socialIdentities: LaunchpointSocialIdentityInput[];
}): Promise<{ creatorsSeen: number; changed: number }> {
  const db = getDatabase();
  const [creatorRows, discordRows, accountRows, existingMappings] = await Promise.all([
    db.select().from(schema.creators).where(eq(schema.creators.organizationId, input.organizationId)),
    db.select().from(schema.creatorDiscord).where(eq(schema.creatorDiscord.organizationId, input.organizationId)),
    db.select().from(schema.socialAccounts).where(eq(schema.socialAccounts.organizationId, input.organizationId)),
    db.select().from(schema.signingRelationships).where(eq(schema.signingRelationships.organizationId, input.organizationId)),
  ]);

  const identities = new Map<string, Set<string>>();
  const addIdentity = (value: string | null | undefined, creatorId: string) => {
    const key = creatorIdentityKey(value);
    if (!key) return;
    const ids = identities.get(key) ?? new Set<string>();
    ids.add(creatorId);
    identities.set(key, ids);
  };
  for (const creator of creatorRows) {
    addIdentity(creator.displayName, creator.id);
    addIdentity(creator.email, creator.id);
  }
  for (const discord of discordRows) {
    addIdentity(discord.username, discord.creatorId);
    addIdentity(discord.displayName, discord.creatorId);
  }
  for (const account of accountRows) {
    if (!account.creatorId) continue;
    addIdentity(account.username, account.creatorId);
    addIdentity(account.displayName, account.creatorId);
  }

  const existingByExternalId = new Map(existingMappings.filter((mapping) => mapping.provider === "launchpoint" && mapping.externalId).map((mapping) => [mapping.externalId!, mapping]));
  const relationshipsByCreator = new Map<string, LaunchpointRelationshipInput[]>();
  for (const relationship of input.relationships) {
    const current = relationshipsByCreator.get(relationship.creatorExternalId) ?? [];
    current.push(relationship);
    relationshipsByCreator.set(relationship.creatorExternalId, current);
  }
  const socialByCreator = new Map<string, LaunchpointSocialIdentityInput[]>();
  for (const identity of input.socialIdentities) {
    const current = socialByCreator.get(identity.creatorExternalId) ?? [];
    const key = creatorIdentityKey(identity.username);
    if (!current.some((item) => item.platform === identity.platform && creatorIdentityKey(item.username) === key)) current.push(identity);
    socialByCreator.set(identity.creatorExternalId, current);
  }

  let changed = 0;
  for (const providerCreator of input.creators) {
    const existing = existingByExternalId.get(providerCreator.externalId);
    let creatorId: string | null | undefined = existing?.creatorId;
    if (!creatorId) {
      for (const value of [providerCreator.email, providerCreator.username, providerCreator.displayName]) {
        const key = creatorIdentityKey(value);
        const candidates = key ? identities.get(key) : null;
        if (candidates?.size === 1) { creatorId = [...candidates][0]!; break; }
      }
    }
    let verificationMethod = existing?.verificationMethod ?? "automatic_exact_identity";
    if (!creatorId) {
      const [created] = await db.insert(schema.creators).values({
        organizationId: input.organizationId,
        displayName: providerCreator.displayName,
        email: providerCreator.email ?? null,
        lifecycle: "request",
        attentionState: "Launchpoint creator needs Discord and social account confirmation",
        nextStep: "Confirm Discord identity and tracked social accounts",
        lastActivityAt: new Date(),
      }).returning({ id: schema.creators.id });
      if (!created) continue;
      creatorId = created.id;
      verificationMethod = "launchpoint_seeded_creator";
      await db.insert(schema.activityEvents).values({ organizationId: input.organizationId, creatorId, type: "creator.discovered_from_launchpoint", summary: `${providerCreator.displayName} was discovered in Launchpoint and added to Result.`, metadata: { provider: "launchpoint", externalId: providerCreator.externalId } });
      changed += 1;
    }

    addIdentity(providerCreator.displayName, creatorId);
    addIdentity(providerCreator.email, creatorId);
    addIdentity(providerCreator.username, creatorId);
    const relationships = (relationshipsByCreator.get(providerCreator.externalId) ?? []).sort((a, b) => relationshipPriority(b.state) - relationshipPriority(a.state));
    const current = relationships[0];
    const socialIdentities = socialByCreator.get(providerCreator.externalId) ?? [];
    const values = {
      creatorId,
      program: current?.program ?? null,
      state: current?.state ?? "pending" as const,
      startsAt: current?.startsAt ? new Date(current.startsAt) : null,
      endsAt: current?.endsAt ? new Date(current.endsAt) : null,
      sourceUrl: providerCreator.sourceUrl ?? null,
      verificationMethod,
      verifiedAt: existing?.verifiedAt ?? new Date(),
      lastSyncedAt: new Date(),
      lastError: null,
      raw: { creator: providerCreator, relationships, socialIdentities },
      updatedAt: new Date(),
    };
    if (existing) {
      await db.update(schema.signingRelationships).set(values).where(eq(schema.signingRelationships.id, existing.id));
    } else {
      await db.insert(schema.signingRelationships).values({ organizationId: input.organizationId, provider: "launchpoint", syncMode: "api", externalId: providerCreator.externalId, ...values });
      await db.insert(schema.activityEvents).values({ organizationId: input.organizationId, creatorId, type: "provider.mapping_created", summary: "Launchpoint was connected to this Result creator.", metadata: { provider: "launchpoint", externalId: providerCreator.externalId, verificationMethod } });
    }
    changed += 1;
  }

  changed += await reconcileCreatorAccountLinks(input.organizationId);
  return { creatorsSeen: input.creators.length, changed };
}
