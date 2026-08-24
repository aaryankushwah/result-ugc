import { activityEvents, creators, scriptAssignments, scripts } from "@result/db";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { managerContext, mutationErrorResponse, MutationError } from "@/lib/mutation-context";
import { invalidatePortalData } from "@/lib/portal-cache";

const assignmentSchema = z.object({
  creatorIds: z.array(z.uuid()).min(1).max(20),
  dueAt: z.iso.datetime().nullable().optional(),
  message: z.string().trim().max(2_000).nullable().optional(),
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
    const dueAt = parsed.data.dueAt ? new Date(parsed.data.dueAt) : null;
    await context.db.transaction(async (transaction) => {
      for (const creator of creatorRows) {
        await transaction.insert(scriptAssignments).values({
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
        });
      }
      await transaction.update(scripts).set({ status: "assigned", updatedByUserId: context.internalUser?.id ?? null, updatedAt: new Date() }).where(and(eq(scripts.id, id), eq(scripts.organizationId, context.organization.id)));
      await transaction.insert(activityEvents).values({
        organizationId: context.organization.id,
        actorUserId: context.internalUser?.id ?? null,
        type: "script.assigned",
        summary: `Script “${script.title}” was assigned to ${creatorRows.map((creator) => creator.name).join(", ")}.`,
        metadata: { scriptId: id, creatorIds: creatorRows.map((creator) => creator.id), dueAt: dueAt?.toISOString() ?? null },
      });
    });
    invalidatePortalData();
    return Response.json({ ok: true, assignments: creatorRows.map((creator) => ({ creatorId: creator.id, creatorName: creator.name, state: "assigned", dueAt: dueAt?.toISOString() ?? null })) });
  } catch (error) {
    return mutationErrorResponse(error);
  }
}
