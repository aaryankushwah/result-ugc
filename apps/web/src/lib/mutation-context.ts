import "server-only";

import { getDatabase, internalUsers, organizations } from "@result/db";
import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "./auth";

export async function managerContext() {
  const user = await getCurrentUser();
  if (!user) throw new MutationError(401, "Authentication required");
  if (!(["admin", "ugc_manager"] as const).includes(user.role as "admin" | "ugc_manager")) throw new MutationError(403, "Manager role required");
  if (!process.env.DATABASE_URL) throw new MutationError(503, "Database is not configured");
  const organization = (await getDatabase().select().from(organizations).where(eq(organizations.slug, "result")).limit(1))[0];
  if (!organization) throw new MutationError(503, "Result organization is not initialized");
  let internal = (await getDatabase().select().from(internalUsers).where(and(eq(internalUsers.organizationId, organization.id), eq(internalUsers.discordUserId, user.id))).limit(1))[0];
  if (!internal) [internal] = await getDatabase().insert(internalUsers).values({ organizationId: organization.id, discordUserId: user.id, displayName: user.name, avatarUrl: user.avatarUrl, role: user.role, lastLoginAt: new Date() }).returning();
  return { user, organization, internalUser: internal ?? null, db: getDatabase() };
}

export class MutationError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export function mutationErrorResponse(error: unknown): Response {
  if (error instanceof MutationError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: error instanceof Error ? error.message : "Operation failed" }, { status: 500 });
}
