import { activityEvents, creatorDiscord, creators, discordOperations, scriptAssignments, scripts } from "@result/db";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

const assignmentSchema = z.object({
  creatorIds: z.array(z.uuid()).min(1).max(20),
  dueAt: z.iso.datetime().nullable().optional(),
  message: z.string().trim().max(2_000).nullable().optional(),
  notifyCreator: z.boolean().default(false),
  notificationRequestId: z.uuid().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = assignmentSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Choose at least one valid Result creator.", details: parsed.error.flatten() }, { status: 400 });
    const context = await managerContext();
    const script = (await context.db.select({ id: scripts.id, title: scripts.title }).from(scripts).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id))).limit(1))[0];
    if (!script) throw new MutationError(404, "Script not found");
    const creatorRows = await context.db.select({ id: creators.id, name: creators.displayName }).from(creators).where(and(eq(creators.organizationId, context.organization.id), inArray(creators.id, parsed.data.creatorIds)));
    if (creatorRows.length !== new Set(parsed.data.creatorIds).size) throw new MutationError(400, "One or more creators do not belong to this Result workspace");
    const discordRows = parsed.data.notifyCreator
      ? await context.db.select({ creatorId: creatorDiscord.creatorId, guildId: creatorDiscord.guildId, discordUserId: creatorDiscord.discordUserId }).from(creatorDiscord).where(and(eq(creatorDiscord.organizationId, context.organization.id), inArray(creatorDiscord.creatorId, parsed.data.creatorIds)))
      : [];
    const discordByCreatorId = new Map(discordRows.map((connection) => [connection.creatorId, connection]));
    if (parsed.data.notifyCreator) {
      const missingDiscord = creatorRows.filter((creator) => !discordByCreatorId.get(creator.id)?.discordUserId);
      if (missingDiscord.length) throw new MutationError(409, `${missingDiscord.map((creator) => creator.name).join(", ")} ${missingDiscord.length === 1 ? "is" : "are"} not connected to Discord. Uncheck “Notify creator in Discord” to assign silently.`);
    }
    const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
    const notificationRequestId = parsed.data.notificationRequestId ?? crypto.randomUUID();
    const assignmentResults: Array<{ creatorId: string; creatorName: string; assignmentId: string; discordOperationId: string | null }> = [];
    await context.db.transaction(async (transaction) => {
      for (const creator of creatorRows) {
        const [assignment] = await transaction.insert(scriptAssignments).values({
          organizationId: context.organization.id,
          scriptId: id,
          creatorId: creator.id,
          state: "assigned",
          dueAt,
          message: parsed.data.message ?? null,
          assignedByUserId: context.internalUser?.id ?? null,
        }).onConflictDoUpdate({
          target: [scriptAssignments.scriptId, scriptAssignments.creatorId],
          set: { state: "assigned", dueAt, message: parsed.data.message ?? null, assignedByUserId: context.internalUser?.id ?? null, updatedAt: new Date() },
        }).returning({ id: scriptAssignments.id });
        if (!assignment) throw new MutationError(500, `Could not assign “${script.title}” to ${creator.name}`);

        let discordOperationId: string | null = null;
        if (parsed.data.notifyCreator) {
          const connection = discordByCreatorId.get(creator.id);
          const guildId = connection?.guildId ?? context.organization.discordGuildId;
          if (!guildId) throw new MutationError(409, `${creator.name} has no Discord server mapping. Uncheck “Notify creator in Discord” to assign silently.`);
          const [operation] = await transaction.insert(discordOperations).values({
            organizationId: context.organization.id,
            creatorId: creator.id,
            guildId,
            type: "send_script_assignment",
            idempotencyKey: `script-assignment:${notificationRequestId}:${creator.id}`,
            payload: {
              assignmentId: assignment.id,
              scriptId: id,
              scriptTitle: script.title,
              message: parsed.data.message ?? null,
              discordUserId: connection?.discordUserId ?? null,
            },
            requestedByUserId: context.internalUser?.id ?? null,
          }).onConflictDoNothing().returning({ id: discordOperations.id });
          discordOperationId = operation?.id ?? null;
          if (discordOperationId) await transaction.update(scriptAssignments).set({ discordOperationId, updatedAt: new Date() }).where(eq(scriptAssignments.id, assignment.id));
        }
        assignmentResults.push({ creatorId: creator.id, creatorName: creator.name, assignmentId: assignment.id, discordOperationId });
      }
      await transaction.update(scripts).set({ status: "assigned", updatedByUserId: context.internalUser?.id ?? null, updatedAt: new Date() }).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id)));
      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.assigned",
        summary: `Script “${script.title}” was assigned to ${creatorRows.map((creator) => creator.name).join(", ")}${parsed.data.notifyCreator ? " and Discord notification was queued" : " without a Discord notification"}.`,
        metadata: { scriptId: id, creatorIds: creatorRows.map((creator) => creator.id), dueAt: dueAt?.toISOString() ?? null, notifyCreator: parsed.data.notifyCreator, discordOperationIds: assignmentResults.map((assignment) => assignment.discordOperationId).filter(Boolean) },
      });
    });
    invalidatePortalData();
    return Response.json({ ok: true, assignments: assignmentResults.map((assignment) => ({ ...assignment, state: "assigned", dueAt: dueAt?.toISOString() ?? null, notificationState: assignment.discordOperationId ? "queued" : "skipped" })) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
