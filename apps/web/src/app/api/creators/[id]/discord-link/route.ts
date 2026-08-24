import {
  activityEvents,
  creatorDiscord,
  creatorNotes,
  creators,
  discordOperations,
  scriptAssignments,
  scriptTests,
  signingRelationships,
  socialAccounts,
} from "@result/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { invalidatePortalData } from "@/lib/portal-cache";
import { managerContext, mutationErrorResponse } from "@/lib/mutation-context";

const schema = z.object({
  discordUserId: z.string().trim().regex(/^\d{15,22}$/),
  sourceCreatorId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Enter a valid Discord user ID" }, { status: 400 });

    const context = await managerContext();
    const guildId = context.organization.discordGuildId;
    if (!guildId) return Response.json({ error: "The Result Discord server is not configured" }, { status: 409 });

    const [targetCreator, targetConnection, memberConnection] = await Promise.all([
      context.db.select({ id: creators.id, displayName: creators.displayName }).from(creators).where(and(eq(creators.organizationId, context.organization.id), eq(creators.id, id))).limit(1).then((rows) => rows[0]),
      context.db.select().from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, context.organization.id), eq(creatorDiscord.creatorId, id))).limit(1).then((rows) => rows[0]),
      context.db.select().from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, context.organization.id), eq(creatorDiscord.guildId, guildId), eq(creatorDiscord.discordUserId, parsed.data.discordUserId))).limit(1).then((rows) => rows[0]),
    ]);
    if (!targetCreator) return Response.json({ error: "Creator not found" }, { status: 404 });

    const sourceCreatorId = memberConnection?.creatorId !== id ? memberConnection?.creatorId ?? null : null;
    if (sourceCreatorId && parsed.data.sourceCreatorId !== sourceCreatorId) {
      const source = await context.db.select({ displayName: creators.displayName }).from(creators).where(eq(creators.id, sourceCreatorId)).limit(1).then((rows) => rows[0]);
      return Response.json({ error: `That Discord member is already linked to ${source?.displayName ?? "another creator"}. Choose that synced member from the list to merge the duplicate safely.` }, { status: 409 });
    }

    if (sourceCreatorId) {
      const [account, relationship, note, assignment, test] = await Promise.all([
        context.db.select({ id: socialAccounts.id }).from(socialAccounts).where(eq(socialAccounts.creatorId, sourceCreatorId)).limit(1).then((rows) => rows[0]),
        context.db.select({ id: signingRelationships.id }).from(signingRelationships).where(eq(signingRelationships.creatorId, sourceCreatorId)).limit(1).then((rows) => rows[0]),
        context.db.select({ id: creatorNotes.id }).from(creatorNotes).where(eq(creatorNotes.creatorId, sourceCreatorId)).limit(1).then((rows) => rows[0]),
        context.db.select({ id: scriptAssignments.id }).from(scriptAssignments).where(eq(scriptAssignments.creatorId, sourceCreatorId)).limit(1).then((rows) => rows[0]),
        context.db.select({ id: scriptTests.id }).from(scriptTests).where(eq(scriptTests.creatorId, sourceCreatorId)).limit(1).then((rows) => rows[0]),
      ]);
      if (account || relationship || note || assignment || test) return Response.json({ error: "That Discord identity belongs to another creator with saved data, so it cannot be moved automatically." }, { status: 409 });
    }

    const operationId = await context.db.transaction(async (tx) => {
      if (sourceCreatorId && memberConnection) {
        if (targetConnection && targetConnection.id !== memberConnection.id) await tx.delete(creatorDiscord).where(eq(creatorDiscord.id, targetConnection.id));
        await tx.update(creatorDiscord).set({ creatorId: id, updatedAt: new Date() }).where(eq(creatorDiscord.id, memberConnection.id));
        await tx.update(activityEvents).set({ creatorId: id }).where(eq(activityEvents.creatorId, sourceCreatorId));
        await tx.update(discordOperations).set({ creatorId: id, updatedAt: new Date() }).where(eq(discordOperations.creatorId, sourceCreatorId));
        await tx.delete(creators).where(eq(creators.id, sourceCreatorId));
      } else if (targetConnection) {
        await tx.update(creatorDiscord).set({ discordUserId: parsed.data.discordUserId, username: null, displayName: null, avatarUrl: null, state: "unknown", roleIds: [], privateChannelId: null, lastReconciledAt: null, updatedAt: new Date() }).where(eq(creatorDiscord.id, targetConnection.id));
      } else {
        await tx.insert(creatorDiscord).values({ organizationId: context.organization.id, creatorId: id, guildId, discordUserId: parsed.data.discordUserId, state: "unknown", roleIds: [] });
      }

      const [operation] = await tx.insert(discordOperations).values({
        organizationId: context.organization.id,
        creatorId: id,
        guildId,
        type: "restore_access",
        idempotencyKey: `discord-link:${id}:${parsed.data.discordUserId}:${new Date().toISOString()}`,
        payload: { discordUserId: parsed.data.discordUserId, reason: "Discord identity linked by a Result manager" },
        requestedByUserId: context.internalUser?.id ?? null,
      }).returning({ id: discordOperations.id });

      await tx.insert(activityEvents).values({
        organizationId: context.organization.id,
        creatorId: id,
        actorUserId: context.internalUser?.id ?? null,
        type: "discord.identity_linked",
        summary: `Discord identity was linked to ${targetCreator.displayName}; access restoration was queued.`,
        metadata: { discordUserId: parsed.data.discordUserId, mergedSourceCreatorId: sourceCreatorId },
      });
      return operation?.id ?? null;
    });

    invalidatePortalData();
    return Response.json({ ok: true, operationId, mergedSourceCreatorId: sourceCreatorId });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
